/**
 * 观感验证工具：把一组特制页面渲成 PNG 静帧，用来肉眼核对视觉改动。
 * 用法（在仓库根目录）：node server/scripts/stills.mjs
 * 产物：server/out/stills/*.png
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const renderDir = path.join(repoRoot, "server", "render");
const outDir = path.join(repoRoot, "server", "out", "stills");
const serveUrl = path.join(renderDir, "out", "bundle");
const FPS = 30;

// 与 shared/types.ts 的 TRANSITION_FRAME_MAP 保持一致
const TF = { none: 1, fade: 12, "slide-left": 14, "slide-right": 14, zoom: 16 };

const page = (o) => ({
  pageIndex: 0,
  title: "",
  points: [],
  narration: "",
  captions: [],
  chart: null,
  durationSec: 4,
  ...o,
});

const pages = [
  page({
    pageIndex: 0,
    title: "为什么电池会热失控",
    layout: "title",
    points: [
      { text: "一条四步连锁反应", icon: "bolt" },
      { text: "从升温一路烧到爆炸", icon: "alert" },
      { text: "3 分钟讲清机制", icon: "clock" },
    ],
    captions: ["热失控是一条四步连锁反应。"],
    rhythm: "anchor",
    transition: "fade",
    effects: { threeD: true, pathDraw: true },
    durationSec: 4,
  }),
  page({
    pageIndex: 1,
    title: "四步连锁：每一环都在放大热量",
    layout: "points",
    points: [
      { text: "升温：内阻发热累积", icon: "trend", anchor: 0 },
      { text: "隔膜崩溃：正负极短路", icon: "alert", anchor: 1 },
      { text: "电解液分解：产气膨胀", icon: "gear", anchor: 2 },
      { text: "热蔓延：相邻电芯连锁", icon: "link", anchor: 3 },
    ],
    captions: ["第一步升温。", "第二步隔膜崩溃。", "第三步电解液分解。", "第四步热蔓延。"],
    rhythm: "dense",
    accent: 2,
    transition: "slide-left",
    // 手绘圈注（effects.annotation）：验证 rough-notation 真的把标题圈出来了
    effects: { annotation: "circle" },
    durationSec: 4,
  }),
  page({
    pageIndex: 2,
    title: "关键量级",
    layout: "stats",
    points: [
      { text: "80℃ 起始", icon: "trend" },
      { text: "3 倍 温升速率", icon: "chart" },
      { text: "60 秒 到失控", icon: "clock" },
      { text: "100% 连锁概率", icon: "alert" },
    ],
    captions: ["量级决定处置窗口。"],
    effects: { annotation: "highlight" },
    rhythm: "anchor",
    accent: 1,
    decor: "quiet",
    transition: "zoom",
    durationSec: 4,
  }),
  page({
    pageIndex: 3,
    title: "隔膜一破，温升陡增",
    layout: "chart",
    chart: {
      type: "bar",
      title: "温升速率（℃/分钟）",
      labels: ["升温", "隔膜崩溃", "产气膨胀"],
      values: [80, 240, 380],
    },
    points: [{ text: "隔膜崩溃后温升陡增" }, { text: "产气阶段最快" }],
    captions: ["隔膜一破，温升速度就是三倍起。"],
    accent: 0,
    transition: "fade",
    durationSec: 4,
  }),
  page({
    pageIndex: 4,
    title: "第二步：隔膜崩溃",
    layout: "section",
    points: [{ text: "正负极直接短路" }],
    captions: ["接下来是最关键的一步。"],
    icon: "alert",
    transition: "fade",
    durationSec: 3,
  }),
  page({
    pageIndex: 5,
    title: "油车与电车的账",
    layout: "comparison",
    points: [{ text: "油费 1.28 万 vs 电费 1500 元" }, { text: "8 年总账 12 万 vs 2 万" }],
    comparisonSides: {
      a: { title: "燃油车", points: ["油费 1.28 万/年", "保养 2000 元/年", "8 年总账 12 万"] },
      b: { title: "电动车", points: ["电费 1500 元/年", "保养 0 元/年", "8 年总账 2 万"] },
    },
    captions: ["油车一年一万二，电车一千五。"],
    transition: "fade",
    durationSec: 4,
  }),
  page({
    pageIndex: 6,
    title: "记住这一条链",
    layout: "end",
    points: [{ text: "先控温，再断路，最后隔离" }],
    captions: ["先控温，再断路，最后隔离。"],
    transition: "none",
    durationSec: 3,
  }),
];

const inputProps = {
  projectTitle: "",
  pages,
  fps: FPS,
  subtitles: true,
  bgm: null,
  theme: process.env.STILL_THEME || "tech",
  width: 1920,
  height: 1080,
};

const starts = [];
let offset = 0;
pages.forEach((p, i) => {
  starts.push(offset);
  const dur = Math.round((p.durationSec || 4) * FPS);
  const next = pages[i + 1];
  offset += dur - (next ? (TF[next.transition] ?? 12) : 0);
});

const shots = [
  { name: "01-title-3dflip", frame: 2 },
  { name: "02-title-pathdraw-mid", frame: 14 },
  { name: "03-title-settled", frame: 70 },
  { name: "04-transition-slide-mid", frame: starts[1] + 7 },
  { name: "05-points-settled", frame: starts[1] + 70 },
  { name: "06-transition-zoom-mid", frame: starts[2] + 8 },
  { name: "07-stats-settled", frame: starts[2] + 70 },
  { name: "08-transition-none-cut", frame: starts[6] + 1 },
  { name: "09-end-settled", frame: starts[6] + 40 },
  { name: "10-chart-bar-settled", frame: starts[3] + 70 },
  { name: "11-section-settled", frame: starts[4] + 60 },
  { name: "12-comparison-settled", frame: starts[5] + 80 },
  { name: "13-caption-karaoke-mid", frame: starts[1] + 22 },
  { name: "14-caption-karaoke-late", frame: starts[1] + 46 },
];

const run = (configPath) =>
  new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(renderDir, "run-render.mjs"), configPath], {
      cwd: renderDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let err = "";
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}: ${err.slice(-500)}`))));
  });

mkdirSync(outDir, { recursive: true });
console.log(`[stills] 总帧数 ${offset}，共 ${shots.length} 张，theme=${inputProps.theme}`);

const only = process.env.STILL_ONLY;
const picked = only ? shots.filter((s) => s.name.includes(only)) : shots;
for (const shot of picked) {
  const outPng = path.join(outDir, `${inputProps.theme}-${shot.name}.png`);
  const configPath = path.join(outDir, `${inputProps.theme}-${shot.name}.still.json`);
  writeFileSync(
    configPath,
    JSON.stringify({
      mode: "still",
      serveUrl,
      compositionId: "DynamicVideo",
      output: outPng,
      inputProps,
      frame: shot.frame,
      options: { gl: process.env.RENDER_GL || "swiftshader" },
    }),
  );
  const t0 = Date.now();
  try {
    await run(configPath);
    console.log(`  ok ${shot.name} (frame ${shot.frame}, ${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`  FAIL ${shot.name}: ${e.message}`);
  } finally {
    rmSync(configPath, { force: true });
  }
}

console.log(`[stills] 完成 -> ${outDir}`);
