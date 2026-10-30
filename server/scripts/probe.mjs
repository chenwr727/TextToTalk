/**
 * DOM 探针：把某一版式在某一帧**真实渲染出来的布局**导出来，而不是靠看 PNG 数像素。
 *
 *   CHROME_PATH=... REMOTION_PORT=8801 node server/scripts/probe.mjs \
 *     --page=points --selector='div[style*="border-radius: 20px"]' --selector='div[style*="display: flex; flex-direction: column"]'
 *
 * 为什么需要：Remotion 在无头 Chrome 里渲染，浏览器拿不到文件系统，产物只有 PNG。
 * 布局类改动于是只能"改代码 → 重渲 → 肉眼看图"，一轮 1~3 分钟，而且经常看错。
 * 这个脚本让"为什么宽度没生效"这类问题一次就能定位：它会把目标元素、以及它到根节点
 * 每一层决定宽度的祖先的 rect 与 computed style 都打印出来。
 *
 * 环境变量：
 *   CHROME_PATH      必填，无头浏览器路径（与 gallery.mjs 一致）
 *   REMOTION_PORT    固定端口，避免并发抢端口
 *
 * 参数：
 *   --page=<子串>      选择样本页（按 layout / 文件名匹配，默认 points）
 *   --frame=<n>        绝对帧号；不给则取该页 60% 处（与 gallery 同一口径）
 *   --selector=<css>   可重复，要测量的元素
 *   --html             额外导出整页 HTML
 *   --out=<dir>        输出目录，默认 server/out/probe
 *
 * 输出：
 *   <out>/<name>.layout.json   结构化报告（rect / computed style / 祖先链）
 *   <out>/<name>.html          整页 HTML（--html 时）
 *   <out>/<name>.png           同帧成图（对照用）
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, pageName } from "./gallery-pages.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const renderDir = path.join(repoRoot, "server", "render");
const serveUrl = path.join(renderDir, "out", "bundle");
const FPS = 30;
/** 转场重叠帧（与 gallery / DynamicVideo 同口径） */
const TRANSITION = 12;

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const multiOf = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));

const wantPage = argOf("page", "points");
const wantFrame = argOf("frame", null);
const wantHtml = argv.includes("--html");
const outDir = argOf("out", path.join(repoRoot, "server", "out", "probe"));
const selectors = multiOf("selector");
const wantText = argOf("text", null);
if (!selectors.length && !wantText) {
  console.error("至少要给一个 --selector=<css> 或 --text=<文字片段>");
  process.exit(2);
}

const theme = argOf("theme", "tech");
const SIZE = argOf("size", "landscape").trim();
const [CANVAS_W, CANVAS_H] = SIZE === "portrait" ? [1080, 1920] : [1920, 1080];

// 精确同名优先（points 与 points-long 都在样本里，模糊匹配会选错页）
const all = PAGES.filter((p) => pageName(p).includes(wantPage) || String(p.layout).includes(wantPage));
const targets = all.length
  ? [...all].sort((a, b) => (pageName(a) === wantPage ? -1 : 0) - (pageName(b) === wantPage ? -1 : 0))
  : all;
if (!targets.length) {
  console.error(`没有匹配 "${wantPage}" 的样本页；可用：${PAGES.map(pageName).join(", ")}`);
  process.exit(2);
}

/**
 * 起始帧必须按**完整**页面列表算，不能只把目标页传给 composition。
 * 原因：sceneRegistry 第一条是 `isFirst → TitleScene`，单页渲染会让目标页变成"第一页"，
 * 量到的就是标题版式的布局（这个坑真踩过：探针第一版量到的是 TitleScene 的药丸行）。
 */
const starts = [];
let cursor = 0;
PAGES.forEach((p, i) => {
  starts.push(cursor);
  cursor += Math.round(p.durationSec * FPS) - (i === PAGES.length - 1 ? 0 : TRANSITION);
});

const index = PAGES.indexOf(targets[0]);
const target = targets[0];
const frame = wantFrame !== null ? Number(wantFrame) : starts[index] + Math.round(target.durationSec * FPS * 0.6);
const name = pageName(target);

mkdirSync(outDir, { recursive: true });
const logPath = path.join(outDir, `${name}.browser.log`);
const stillPath = path.join(outDir, `${name}.png`);
const configPath = path.join(outDir, `${name}.probe.json`);
rmSync(logPath, { force: true });

const inputProps = {
  projectTitle: "DOM 探针",
  pages: PAGES,
  fps: FPS,
  subtitles: true,
  theme,
  width: CANVAS_W,
  height: CANVAS_H,
  probe: { selectors, html: wantHtml, text: wantText || undefined },
};

writeFileSync(
  configPath,
  JSON.stringify(
    {
      mode: "still",
      serveUrl,
      compositionId: "DynamicVideo",
      output: stillPath,
      inputProps,
      frame,
      options: { gl: "swiftshader", browserLogPath: logPath },
    },
    null,
    2,
  ),
);

console.log(
  `[probe] ${name} @ frame ${frame}（${selectors.length} 个选择器${wantText ? ` + 文字 "${wantText}"` : ""}）`,
);

const runStill = (cfg) =>
  new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(renderDir, "run-render.mjs"), cfg], {
      cwd: renderDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let err = "";
    child.stdout.on("data", (b) => process.stdout.write(b));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `退出码 ${code}`))));
  });

await runStill(configPath);

if (!existsSync(logPath)) {
  console.error("[probe] 没有拿到浏览器日志：确认渲染成功、且 inputProps.probe 已传到 composition");
  process.exit(1);
}

const logs = readFileSync(logPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { type: "raw", text: line };
    }
  });

const probeLines = logs.filter((l) => typeof l.text === "string" && l.text.startsWith("TTT_PROBE "));
if (!probeLines.length) {
  console.error("[probe] 页面没有输出探针数据；可能是选择器异常或 probe 未挂载。原始日志：");
  for (const l of logs.slice(-10)) console.error(`  ${l.type}: ${String(l.text).slice(0, 300)}`);
  process.exit(1);
}

const payload = JSON.parse(probeLines[probeLines.length - 1].text.slice("TTT_PROBE ".length));
const layoutPath = path.join(outDir, `${name}.layout.json`);
writeFileSync(layoutPath, JSON.stringify(payload, null, 2));

// ---- 终端报告：先给结论（每个选择器命中几个、宽度多少），再给祖先链 ----
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n[probe] 视口 ${payload.viewport.w}×${payload.viewport.h}，frame ${payload.frame}`);
for (const block of payload.report) {
  if (block.error) {
    console.log(`\n✗ ${block.selector}\n  ${block.error}`);
    continue;
  }
  console.log(`\n▸ ${block.selector}  命中 ${block.count} 个`);
  for (const [i, item] of block.items.entries()) {
    const { x, y, w, h } = item.rect;
    console.log(
      `  [${i}]${item.visible ? " ●" : " ○"} <${item.tag}> rect=(${x},${y}) ${w}×${h}  display=${item.styles.display} flex=${item.styles.flex} alignSelf=${item.styles.alignSelf} width=${item.styles.width} min/max=${item.styles.minWidth}/${item.styles.maxWidth}`,
    );
    if (item.inline) console.log(`      行内: ${item.inline.slice(0, 200)}`);
    item.chain.forEach((a, d) => {
      const r = a.rect;
      console.log(
        `      ${"↑".repeat(d + 1)} <${a.tag}> ${pad(`${r.w}×${r.h}`, 11)} display=${pad(a.styles.display, 12)} flexDir/align=${pad(a.styles.alignItems, 12)} width=${pad(a.styles.width, 10)} alignSelf=${a.styles.alignSelf}`,
      );
    });
  }
}
if (payload.html) {
  const htmlPath = path.join(outDir, `${name}.html`);
  writeFileSync(htmlPath, payload.html);
  console.log(`\n[probe] HTML -> ${htmlPath}`);
}
console.log(`\n[probe] 结构 -> ${layoutPath}`);
console.log(`[probe] 同帧成图 -> ${stillPath}`);
