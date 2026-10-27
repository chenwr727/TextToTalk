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
 *   GALLERY_ONLY=<子串>     只渲部分版式（如 GALLERY_ONLY=card）
 *   GALLERY_THEME=<id>      主题，默认 tech
 * 输出：server/out/gallery/<theme>/<layout>.png
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const renderDir = path.join(repoRoot, "server", "render");
const serveUrl = path.join(renderDir, "out", "bundle");
const FPS = 30;

const page = (o) => ({
  pageIndex: 0,
  title: "",
  points: [],
  narration: "",
  captions: ["这是这一页的口播字幕，用来判断字幕条与正文的层级关系。"],
  chart: null,
  durationSec: 8,
  accent: 0,
  ...o,
});

/** 每种版式一页"真实文案"：判断这套版式在真实内容下的观感，而不是空壳好看 */
const PAGES = [
  page({
    layout: "title",
    role: "hook",
    title: "为什么组织越管越僵",
    points: [{ text: "三个信号，说明流程正在反噬效率" }],
    captions: ["先讲个真事：一家 40 人的公司，审批环节有 11 道。"],
    accent: 0,
  }),
  page({ layout: "section", role: "transition", title: "第一部分 · 症状", accent: 1 }),
  page({
    layout: "points",
    title: "流程反噬效率的三个信号",
    points: [
      { text: "同一件事要过三道审批，每道都在等上一个人" },
      { text: "新人入职两周还没跑通报销流程" },
      { text: "跨部门协作的第一反应是拉会，而不是找人" },
    ],
    accent: 2,
  }),
  page({
    layout: "three_card",
    title: "三种典型的组织病",
    points: [
      { text: "审批链过长，决策被反复上推", icon: "clock" },
      { text: "责任边界模糊，没人愿意拍板", icon: "alert" },
      { text: "信息只在会上流动，落地靠喊", icon: "users" },
    ],
    accent: 3,
  }),
  page({
    layout: "comparison",
    title: "工具型流程 vs 目的型流程",
    comparisonSides: {
      a: { label: "工具型", points: ["流程服务于目标", "例外有明确出口", "审批层级不超过两层"] },
      b: { label: "目的型", points: ["目标服务于流程", "例外一律上报", "层级越多越安全"] },
    },
    accent: 4,
  }),
  page({
    layout: "steps",
    title: "把审批链砍到两层",
    points: [
      { text: "盘点全流程，标出无人负责的节点" },
      { text: "把决策权下沉到直接主管" },
      { text: "给例外情况设置 24 小时兜底出口" },
      { text: "每季度回看一次，删掉不用的环节" },
    ],
    accent: 5,
  }),
  page({
    layout: "stats",
    title: "砍掉中间层之后",
    // StatsScene 从要点文案里抽第一个数字当主视觉，文案本身要带数字才不是空壳
    points: [{ text: "审批时长 1.5 天" }, { text: "周会减少 40%" }, { text: "满意度 +12 分" }],
    accent: 0,
  }),
  page({
    layout: "chart",
    title: "审批环节数与落地周期的关系",
    chart: { type: "bar", title: "落地周期", labels: ["3 环", "6 环", "9 环", "12 环"], values: [7, 14, 23, 38] },
    accent: 1,
  }),
  page({
    layout: "chart",
    title: "人数增长与审批滞留",
    chart: { type: "line", title: "平均滞留天数", labels: ["Q1", "Q2", "Q3", "Q4"], values: [12, 19, 26, 41] },
    accent: 3,
  }),
  page({
    layout: "chart",
    title: "返工量随层级递增",
    chart: { type: "area", title: "月均返工单", labels: ["1 层", "2 层", "3 层", "4 层"], values: [8, 17, 29, 46] },
    accent: 5,
  }),
  page({
    layout: "chart",
    title: "三块成本逐年变化",
    chart: {
      type: "stacked-bar",
      title: "成本结构（万元）",
      labels: ["2021", "2022", "2023"],
      series: [
        { name: "人力", values: [12, 18, 26] },
        { name: "工具", values: [6, 9, 14] },
        { name: "外包", values: [4, 5, 9] },
      ],
    },
    accent: 4,
  }),
  page({
    layout: "chart",
    title: "规模与周期并不成正比",
    chart: {
      type: "scatter",
      title: "公司规模 / 审批周期",
      points: [
        { x: 20, y: 4, label: "小团队" },
        { x: 80, y: 9, label: "中型" },
        { x: 220, y: 15, label: "大型" },
        { x: 600, y: 22, label: "集团" },
      ],
    },
    accent: 2,
  }),
  page({
    layout: "table",
    title: "三种审批模式的取舍",
    table: {
      headers: ["模式", "决策速度", "风险", "适合场景"],
      rows: [
        ["一人拍板", "最快", "集中", "小金额、高频"],
        ["三人会签", "中等", "分散", "中等风险"],
        ["多层审批", "最慢", "最分散", "合规强约束"],
      ],
    },
    accent: 2,
  }),
  page({
    layout: "table",
    _name: "numeric",
    title: "三种方案的成本对比",
    table: {
      headers: ["方案", "月成本", "人力投入", "上线周期"],
      rows: [
        ["自建", "12000 元", "3 人", "4 个月"],
        ["采购", "38000 元", "1 人", "1 个月"],
        ["外包", "25000 元", "0.5 人", "2 个月"],
      ],
    },
    accent: 3,
  }),
  page({
    layout: "two_column",
    title: "两种改法的代价",
    points: [
      { text: "激进重构" },
      { text: "三个月内推倒重来，短期效率必然下滑" },
      { text: "渐进修剪" },
      { text: "每季度删掉一环，阵痛分摊到日常" },
    ],
    accent: 3,
  }),
  page({
    layout: "qa",
    title: "常见疑问",
    points: [
      { text: "砍层级会不会失控？" },
      { text: "不会。失控来自信息不透明，不来自层级少。把结果指标公开，比多两道审批更有效。" },
    ],
    accent: 4,
  }),
  page({
    layout: "map",
    title: "三个部门的协作断点",
    map: {
      // MapScene 会按点位包围盒自动缩放，这里给"像素级"散布坐标即可
      markers: [
        { name: "产品 · 上海", x: 1180, y: 520 },
        { name: "研发 · 杭州", x: 780, y: 640 },
        { name: "运营 · 成都", x: 420, y: 430 },
      ],
      routes: [
        { from: 0, to: 1, type: "road", animated: true },
        { from: 1, to: 2, type: "road", animated: true },
      ],
    },
    accent: 5,
  }),
  page({
    layout: "end",
    role: "cta",
    title: "好的流程，是让对的人少等一会儿",
    points: [{ text: "下期讲：怎么判断一个流程该删还是该改" }],
    accent: 0,
  }),
];

const theme = process.env.GALLERY_THEME || "tech";
/** 画布尺寸：landscape（默认 1920×1080）或 portrait（1080×1920） */
const SIZE = (process.env.GALLERY_SIZE || "landscape").trim();
const [CANVAS_W, CANVAS_H] = SIZE === "portrait" ? [1080, 1920] : [1920, 1080];
const only = (process.env.GALLERY_ONLY || "").trim();
const targets = PAGES.filter((p) => !only || String(p.layout).includes(only));

/** 页面起始帧：页长 - 转场重叠，与 DynamicVideo 的时间轴一致（转场 12 帧） */
const TRANSITION = 12;
const starts = [];
let cursor = 0;
targets.forEach((p, i) => {
  starts.push(cursor);
  cursor += Math.round(p.durationSec * FPS) - (i === targets.length - 1 ? 0 : TRANSITION);
});

const outDir = path.join(repoRoot, "server", "out", "gallery", `${theme}${SIZE === "portrait" ? "-portrait" : ""}`);
mkdirSync(outDir, { recursive: true });

const inputProps = {
  projectTitle: "设计评审",
  pages: targets,
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
let i = 0;
for (const p of targets) {
  const idx = i++;
  const frame = starts[idx] + Math.round(p.durationSec * FPS * 0.6);
  // 同一版式可能有多个样本（如四种图表），文件名带上图表类型避免互相覆盖
  const name = p.chart?.type ? `${p.layout}-${p.chart.type}` : p.table && p._name ? `${p.layout}-${p._name}` : p.layout;
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
