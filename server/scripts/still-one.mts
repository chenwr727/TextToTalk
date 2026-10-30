/**
 * 单页静帧调试器。
 *
 * 为什么不用 gallery：gallery 只传一页时那页会变成「第一页」（TitleScene），
 * 有些版式渲染结果跟整片里的同一页不一样，复现不了 bug。这里照抄 e2e 的静帧逻辑：
 * 传完整 pages 列表 + 与 e2e 一致的取帧位置，只把目标页换成你指定的那一页/那一帧。
 *
 * 用法：
 *   node --import tsx server/scripts/still-one.mts <pageIndex> <out.png> [选项]
 *
 * 选项：
 *   --annotation <kind>   覆盖该页的手绘标注（underline / circle / highlight / …）
 *   --frame <n>           指定整片帧号（覆盖默认的"页内中段"取帧）
 *   --at <0..1>           按页内比例取帧（如 0.15 = 入场阶段，0.6 = 稳定态）
 *   --size <WxH>          画布尺寸（如 1080x1920），默认沿用分镜
 *   --theme <id>          主题，默认 tech
 *   --storyboard <path>   分镜文件，默认 out/e2e/storyboard.json
 *   --pages <path>        直接给 pages JSON（形如 { storyboard: { pages: [...] } }）
 *   --layout <name>       不给 pageIndex 时按版式名找第一页（如 --layout points）
 *   --log                 打印浏览器 console（TTT_BODY / TTT_PROBE 探针输出落盘位置）
 *
 * 依赖：render/out/bundle 已是最新（改了 render 源码要先跑 node server/render/scripts/bundle.mjs）。
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const FPS = 30;
/** 与 DynamicVideo / shared/types 的 TRANSITION_FRAME_MAP 对齐 */
const TRANSITION_FRAMES: Record<string, number> = {
  none: 0,
  fade: 12,
  slide: 18,
  zoom: 15,
  wipe: 18,
  flip: 20,
  cut: 0,
};

interface Flags {
  pageIndex?: number;
  out: string;
  annotation?: string;
  frame?: number;
  at?: number;
  size?: string;
  theme: string;
  storyboard: string;
  pagesPath?: string;
  layout?: string;
  log: boolean;
}

const parseArgs = (argv: string[]): Flags => {
  const positional: string[] = [];
  const flags: Flags = { out: "", theme: "tech", storyboard: "out/e2e/storyboard.json", log: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`${a} 缺少取值`);
      return v;
    };
    if (a === "--annotation") flags.annotation = next();
    else if (a === "--frame") flags.frame = Number(next());
    else if (a === "--at") flags.at = Number(next());
    else if (a === "--size") flags.size = next();
    else if (a === "--theme") flags.theme = next();
    else if (a === "--storyboard") flags.storyboard = next();
    else if (a === "--pages") flags.pagesPath = next();
    else if (a === "--layout") flags.layout = next();
    else if (a === "--log") flags.log = true;
    else if (a.startsWith("--")) throw new Error(`未知参数 ${a}`);
    else positional.push(a);
  }
  if (positional.length && !Number.isNaN(Number(positional[0]))) flags.pageIndex = Number(positional.shift());
  flags.out = positional.shift() ?? "";
  if (!flags.out) throw new Error("缺少输出 PNG 路径；用法见文件头注释");
  return flags;
};

const flags = parseArgs(process.argv.slice(2));

/** 读分镜：既支持 {storyboard:{pages}}，也支持裸 pages 数组 */
const loadPages = (): { projectTitle?: string; pages: Record<string, unknown>[] } => {
  const file = flags.pagesPath ?? flags.storyboard;
  if (!existsSync(file)) throw new Error(`找不到分镜文件 ${file}`);
  const json = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (Array.isArray(json)) return { pages: json as Record<string, unknown>[] };
  const obj = json as {
    storyboard?: { projectTitle?: string; pages?: Record<string, unknown>[] };
    pages?: Record<string, unknown>[];
  };
  const pages = obj.storyboard?.pages ?? obj.pages;
  if (!pages) throw new Error(`${file} 里没有 pages`);
  return { projectTitle: obj.storyboard?.projectTitle, pages };
};

const { projectTitle, pages: srcPages } = loadPages();

let pageIndex = flags.pageIndex;
if (pageIndex == null) {
  if (!flags.layout) throw new Error("要么给 pageIndex，要么给 --layout");
  pageIndex = srcPages.findIndex((p) => p.layout === flags.layout);
  if (pageIndex < 0) throw new Error(`分镜里没有版式 ${flags.layout}`);
}
if (!(pageIndex >= 0 && pageIndex < srcPages.length)) {
  throw new Error(`pageIndex ${pageIndex} 越界（共 ${srcPages.length} 页）`);
}

// 只改目标页：手绘标注这类效果只对一页生效，改全局会把别的页也带歪
const pages = srcPages.map((p, i) => {
  if (i !== pageIndex || !flags.annotation) return p;
  const effects = (p.effects ?? {}) as Record<string, unknown>;
  return { ...p, effects: { ...effects, annotation: flags.annotation } };
});

/** 每页起始帧：页长 - 转场重叠（与 DynamicVideo 一致） */
const pageStarts = (() => {
  const starts: number[] = [];
  let offset = 0;
  pages.forEach((p, i) => {
    starts.push(offset);
    const dur = Math.round(((p.durationSec as number) || 4) * FPS);
    const next = pages[i + 1];
    offset += dur - (next ? (TRANSITION_FRAMES[(next.transition as string) ?? "fade"] ?? 12) : 0);
  });
  return starts;
})();

const pageDur = Math.round(((pages[pageIndex].durationSec as number) || 4) * FPS);
const frame =
  flags.frame ??
  pageStarts[pageIndex] +
    (flags.at != null ? Math.max(1, Math.round(pageDur * flags.at)) : Math.max(20, Math.round(pageDur / 2)));

const [w, h] = (flags.size ?? "1920x1080").split("x").map(Number);
const inputProps = {
  projectTitle: projectTitle ?? "调试",
  pages,
  fps: FPS,
  subtitles: true,
  theme: flags.theme,
  width: w,
  height: h,
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cfgPath = path.resolve(repoRoot, "server/out/still-one.json");
const logPath = path.resolve(repoRoot, "server/out/still-one.browser.log");
// 日志是 append 写入：不删就会把上一轮的结果当成这一轮的
rmSync(logPath, { force: true });
writeFileSync(
  cfgPath,
  JSON.stringify({
    mode: "still",
    serveUrl: path.resolve(repoRoot, "server/render/out/bundle"),
    compositionId: "DynamicVideo",
    output: path.resolve(flags.out),
    inputProps,
    frame,
    options: { gl: process.env.RENDER_GL || "swiftshader", browserLogPath: logPath },
  }),
);

console.log(
  `[still-one] page=${pageIndex} (${String(pages[pageIndex].layout ?? "-")}) frame=${frame} ` +
    `local=${frame - pageStarts[pageIndex]} ${w}x${h} theme=${flags.theme}${flags.annotation ? ` annotation=${flags.annotation}` : ""}`,
);

const child = spawn(process.execPath, ["run-render.mjs", cfgPath], {
  cwd: path.resolve(repoRoot, "server/render"),
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.on("close", (code) => {
  rmSync(cfgPath, { force: true });
  if (flags.log && existsSync(logPath)) {
    const keep = readFileSync(logPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("TTT_BODY") || l.includes("TTT_PROBE"))
      .slice(-4);
    if (keep.length) console.log(`[still-one] 探针输出（${logPath}）:`);
    for (const l of keep) console.log(`  ${l}`);
  }
  console.log(`[still-one] exit ${code} -> ${path.resolve(flags.out)}`);
  process.exit(code ?? 1);
});
