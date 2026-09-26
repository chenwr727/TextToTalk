import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCompositions, renderStill } from "@remotion/renderer";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderDir = path.resolve(here, "..");
const serveUrl = path.join(renderDir, "out", "bundle");
const outDir = path.join(renderDir, "out", "portrait");

const WINDOWS_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const findBrowser = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cands = [
    ...WINDOWS_CANDIDATES,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const p of cands) if (fs.existsSync(p)) return p;
  return null;
};

const basePage = (i) => ({
  pageIndex: i,
  title: "",
  points: [],
  narration: "",
  captions: [],
  chart: null,
  layout: "points",
  art: null,
  role: null,
  icon: null,
  table: null,
  durationSec: 8,
  transition: "fade",
  motion: "spring",
  sentences: [
    { text: "这是一句用来测量字幕占位的解说词，长度接近真实文案。", seconds: 4, audioUrl: "" },
    { text: "第二句继续补充说明，让字幕条出现两行的情况。", seconds: 4, audioUrl: "" },
  ],
});

const CASES = [
  {
    id: "title",
    label: "封面 title",
    page: { ...basePage(0), title: "睡前充电，你怕了吗", layout: "title", points: [
      { text: "每天睡前，手机放枕边充电", icon: "home" },
      { text: "危险可能就在你身边", icon: "alert" },
      { text: "了解真相，远离风险", icon: "book" },
    ], role: "hook", icon: "alert", effects: { annotation: "circle", pathDraw: true, threeD: true } },
    frame: 150,
  },
  {
    id: "points4",
    label: "要点页 points（4条）",
    page: { ...basePage(1), title: "充电发热，风险暗藏", layout: "points", role: "build", icon: "gear", points: [
      { text: "充电时电池发热是正常现象", icon: "gear" },
      { text: "热量积聚在枕头下难以散发", icon: "layers" },
      { text: "温度升高加速电池老化", icon: "trend" },
      { text: "持续高温可能引发危险", icon: "alert" },
    ] },
    frame: 210,
  },
  {
    id: "points6",
    label: "要点页 points（6条，竖屏两列判定）",
    page: { ...basePage(2), title: "六个要点挤一挤", layout: "points", role: "mechanism", icon: "alert", points: [
      { text: "温度升到150度电池内部开始失控", icon: "alert" },
      { text: "正极分解释放氧气助燃", icon: "bolt" },
      { text: "电解液燃烧热量急剧飙升", icon: "flame" },
      { text: "连锁反应最终可能爆炸起火", icon: "alert" },
      { text: "外壳膨胀变形产生更多热量", icon: "box" },
      { text: "温控失效防护层彻底击穿", icon: "shield" },
    ] },
    frame: 240,
  },
  {
    id: "stats",
    label: "数据页 stats",
    page: { ...basePage(3), title: "热量散不出去，危险翻倍", layout: "stats", role: "evidence", icon: "alert", points: [
      { text: "正常充电：热量顺畅散开，温度稳定在40℃左右", icon: "trend" },
      { text: "枕头遮挡：散热路径被堵，温度直逼60℃", icon: "chart" },
      { text: "60℃什么概念？掌心一碰就烫红", icon: "alert" },
    ], effects: { annotation: "underline" } },
    frame: 180,
  },
  {
    id: "compare",
    label: "对比页 comparison",
    page: { ...basePage(4), title: "被子捂热，散热难", layout: "comparison", role: "compare", icon: "home", comparisonSides: {
      a: { label: "正常充电", points: [
        { text: "手机裸露在空气中，热量能自然散发", icon: "trend" },
        { text: "机身温度维持在正常范围", icon: "check" },
      ] },
      b: { label: "枕头遮挡", points: [
        { text: "被子捂住，热量散不出去", icon: "alert" },
        { text: "温度持续攀升，隐患悄悄积累", icon: "bolt" },
      ] },
    } },
    frame: 200,
  },
  {
    id: "chart",
    label: "图表页 bar chart",
    page: { ...basePage(5), title: "温度对比：40°C与150°C", layout: "chart", role: "scale", icon: "trend", chart: {
      type: "bar", labels: ["充电温度", "临界点"], values: [40, 150], title: "温度对比",
    } },
    frame: 180,
  },
  {
    id: "end",
    label: "结尾页 end",
    page: { ...basePage(6), title: "安全充电，从今晚开始", layout: "end", role: "action", icon: "check", points: [
      { text: "放床头柜，保持通风", icon: "home" },
      { text: "用原装充电器", icon: "check" },
    ] },
    frame: 150,
  },
  {
    id: "timeline",
    label: "结构图 timeline",
    page: { ...basePage(7), title: "热失控的四步连锁", layout: "points", art: "timeline", role: "mechanism", icon: "layers", points: [
      { text: "电池内部温度缓慢升高", icon: "trend" },
      { text: "隔膜受热收缩失效", icon: "layers" },
      { text: "正负极直接接触短路", icon: "bolt" },
      { text: "电解液气化压力剧增", icon: "alert" },
    ] },
    frame: 220,
  },
  {
    id: "threecard",
    label: "三卡片 three_card",
    page: { ...basePage(8), title: "三种常见误区", layout: "three_card", role: "puzzle", icon: "question", points: [
      { text: "整夜充电不会伤害电池，手机有保护", icon: "shield" },
      { text: "放在被子里只是热一点没关系", icon: "home" },
      { text: "随手用杂牌充电器问题不大", icon: "bolt" },
    ] },
    frame: 200,
  },
  {
    id: "twocol",
    label: "两栏 two_column",
    page: { ...basePage(9), title: "机制与后果", layout: "two_column", role: "mechanism", icon: "gear", points: [
      { text: "热量在枕头下无处散发，持续累积", icon: "layers" },
      { text: "电池温度不断升高，加速老化", icon: "trend" },
      { text: "长期高温可能引发鼓包甚至起火", icon: "alert" },
    ] },
    frame: 200,
  },
  {
    id: "qa",
    label: "问答页 qa",
    page: { ...basePage(10), title: "常见疑问解答", layout: "qa", role: "why", icon: "question", points: [
      { text: "为什么白天充电没事？", icon: "clock" },
      { text: "因为枕头和被子会阻断散热通道", icon: "layers" },
      { text: "用原装充电器就能放心吗？", icon: "question" },
      { text: "通风同样重要，别盖住手机", icon: "check" },
    ] },
    frame: 220,
  },
];

async function main() {
  const widths = [
    { suffix: "portrait", width: 1080, height: 1920 },
    { suffix: "landscape", width: 1920, height: 1080 },
  ];
  const only = process.argv[2];
  const cases = only ? CASES.filter((c) => c.id === only) : CASES;
  const browserExecutable = findBrowser();
  console.log("[preview] 浏览器:", browserExecutable || "(Remotion 内置)");
  fs.mkdirSync(outDir, { recursive: true });

  for (const size of widths) {
    for (const c of cases) {
      const composition = {
        id: `preview-${c.id}`,
        width: size.width,
        height: size.height,
        fps: 30,
        durationInFrames: Math.max(60, c.frame + 30),
      };
      const out = path.join(outDir, `${c.id}-${size.suffix}-${size.width}x${size.height}.png`);
      try {
        await renderStill({
          composition,
          serveUrl,
          inputProps: {
            projectTitle: "",
            pages: [c.page],
            fps: 30,
            subtitles: true,
            theme: "tech",
            width: size.width,
            height: size.height,
          },
          frame: c.frame,
          output: out,
          browserExecutable,
          chromiumOptions: { gl: "swiftshader" },
          logLevel: "error",
        });
        console.log(`[preview] OK  ${c.label} ${size.width}x${size.height} -> ${path.basename(out)}`);
      } catch (e) {
        console.log(`[preview] FAIL ${c.label} ${size.width}x${size.height}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
