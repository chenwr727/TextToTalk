/**
 * 版式陈列（design gallery）：每种版式渲一张"已静止"的静帧，用来做视觉评审。
 *
 *   CHROME_PATH=... REMOTION_PORT=8801 node server/scripts/gallery.mjs
 *
 * 与 stills.mjs 的分工：
 *   - stills 盯"动画关键时刻"（入场中点、转场重叠），改动效时用；
 *   - gallery 盯"设计本身"（每个版式的静态成图），改视觉时用，一次看完 14 种版式。
 *
 * 环境变量：
 *   GALLERY_PAGES_JSON=<路径>  改渲任意 pages 数组（如 e2e-generate.mjs 落盘的真实分镜），
 *                              用来核对"真跑模型出来的页面"在画布上的样子
 *   GALLERY_ONLY=<子串>     只渲部分版式（如 GALLERY_ONLY=card）
 *   GALLERY_THEME=<id>      主题，默认 tech
 * 输出：server/out/gallery/<theme>/<layout>.png
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { PAGES as SAMPLES, pageName } from "./gallery-pages.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const renderDir = path.join(repoRoot, "server", "render");
const serveUrl = path.join(renderDir, "out", "bundle");
const FPS = 30;
/** 转场占用帧数（fade 默认 12）：页面起始帧 = 页长 - 转场重叠，与 DynamicVideo 时间轴同口径 */
const TRANSITION = 12;

const theme = process.env.GALLERY_THEME || "tech";
/** 画布尺寸：landscape（默认 1920×1080）或 portrait（1080×1920） */
const SIZE = (process.env.GALLERY_SIZE || "landscape").trim();
const [CANVAS_W, CANVAS_H] = SIZE === "portrait" ? [1080, 1920] : [1920, 1080];
const only = (process.env.GALLERY_ONLY || "").trim();
/**
 * 默认渲设计样本；给了 GALLERY_PAGES_JSON 就渲那份真实分镜。
 *
 * 真实分镜里没有 "_name"，pageName 会退化成 layout，同 layout 多页会互相覆盖——
 * 所以这里补上页码前缀，保证一页一张图。
 */
const pagesJson = (process.env.GALLERY_PAGES_JSON || "").trim();
const PAGES = pagesJson
  ? JSON.parse(readFileSync(pagesJson, "utf8")).storyboard.pages.map((p, i) => ({
      ...p,
      _name: `${String(i + 1).padStart(2, "0")}-${p.layout}`,
    }))
  : SAMPLES;
const targets = PAGES.filter((p) => !only || String(p.layout).includes(only));

/**
 * 页面起始帧：页长 - 转场重叠，与 DynamicVideo 的时间轴一致（转场 12 帧）。
 *
 * 注意：帧和目标页的索引都按**完整** PAGES 算，inputProps 也传完整列表。
 * 只把过滤后的子集传进去会让目标页变成"第一页"，而 sceneRegistry 第一条是
 * `isFirst → TitleScene`，GALLERY_ONLY 渲出来的就不是要看的那个版式了（踩过）。
 */
const starts = [];
let cursor = 0;
PAGES.forEach((p, i) => {
  starts.push(cursor);
  cursor += Math.round(p.durationSec * FPS) - (i === PAGES.length - 1 ? 0 : TRANSITION);
});

const outDir = path.join(repoRoot, "server", "out", "gallery", `${theme}${SIZE === "portrait" ? "-portrait" : ""}`);
mkdirSync(outDir, { recursive: true });

const inputProps = {
  projectTitle: "设计评审",
  pages: PAGES,
  fps: FPS,
  subtitles: true,
  theme,
  width: CANVAS_W,
  height: CANVAS_H,
};

function runStill(configPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(renderDir, "run-render.mjs"), configPath], {
      cwd: renderDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let err = "";
    child.stdout.on("data", (b) => process.stdout.write(b));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `退出码 ${code}`))));
  });
}

console.log(`[gallery] ${targets.length} 个版式，theme=${theme}，size=${CANVAS_W}x${CANVAS_H}`);
for (const p of targets) {
  const idx = PAGES.indexOf(p);
  const frame = starts[idx] + Math.round(p.durationSec * FPS * 0.6);
  // 同一版式可能有多个样本（四种图表 / 两种表格 / 长短两版要点），命名规则见 gallery-pages
  const name = pageName(p);
  const output = path.join(outDir, `${name}.png`);
  const configPath = path.join(outDir, `${name}.still.json`);
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        mode: "still",
        serveUrl,
        compositionId: "DynamicVideo",
        output,
        inputProps,
        frame,
        options: { gl: "swiftshader" },
      },
      null,
      2,
    ),
  );
  const t0 = Date.now();
  await runStill(configPath);
  console.log(
    `  ✓ ${String(name).padEnd(16)} f=${String(frame).padStart(4)} ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
}
console.log(`[gallery] 完成 -> ${outDir}`);