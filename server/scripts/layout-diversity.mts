/**
 * 真实模型批量生成 × N 次：看版式分布，以及兜底路径（deepseek 派生版式）到底在不在工作。
 *
 * 用法（在 server/ 下）：
 *   node --import tsx scripts/layout-diversity.mts            # 默认 3 轮、内置题目
 *   E2E_ROUNDS=5 node --import tsx scripts/layout-diversity.mts
 *   E2E_PROMPT_FILE=scripts/prompts/xxx.txt node --import tsx scripts/layout-diversity.mts
 *
 * 为什么单独写一个脚本：e2e.mts 会顺带渲染静帧和 MP4（每轮 3 分钟起），
 * 而"版式多样性"只需要大纲 + 分镜两步文本生成。这里只跑文本，一轮 20~40s。
 *
 * 关注两个数：
 *   1. **实际版式直方图**：理想情况一页一个版式、不要整片 points；
 *   2. **派生页数**（大纲里没写 layout、由 deriveLayout 推出来的页）：占比高说明
 *      模型在偷懒，也说明 deriveLayout 是真在兜底——两件事都要能看见。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromPlan, generateOutline } from "../src/services/storyboardGenerator.js";
import { normalizeDirect } from "../src/services/normalize.js";
import type { VideoParams } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const ROUNDS = Number(process.env.E2E_ROUNDS ?? 3);
const PROMPT = process.env.E2E_PROMPT_FILE
  ? readFileSync(path.resolve(repoRoot, process.env.E2E_PROMPT_FILE), "utf-8")
  : [
      "做一支 2 分钟左右的短视频，讲‘为什么一条审批要走 11 道’。",
      "受众是被流程卡住的一线员工，要讲清：11 道审批从哪来、卡在哪、砍掉中间层之后发生了什么、",
      "以及一个团队真的把审批压到 3 道的过程。用真实数据支撑，最后给一条能马上动手的建议。",
    ].join("");

/* 与 e2e.mts 保持同一口径：竖屏用 E2E_PORTRAIT=1 切换 */
const PORTRAIT = !!process.env.E2E_PORTRAIT;
const params: VideoParams = {
  width: PORTRAIT ? 1080 : 1920,
  height: PORTRAIT ? 1920 : 1080,
  fps: 30,
  tone: "casual",
  narration: false,
  subtitles: true,
  bgm: "none",
  granularity: "medium",
  theme: process.env.E2E_THEME || "tech",
  targetDurationSec: 90,
};

/*
 * 大纲有没有给版式，只按「字段在不在」判：
 * 给了但写错的会被 normalizePage 降级，那算另一类问题（下面也会看到）。
 */
const known = { has: (s: string) => !!s.trim() };

let planned = 0;
let derived = 0;
const histogram = new Map<string, number>();
const perRound: string[][] = [];

for (let round = 1; round <= ROUNDS; round++) {
  process.stdout.write(`\n[e2e] 第 ${round}/${ROUNDS} 轮：大纲 + 逐页展开… `);
  const t0 = Date.now();
  const plan = await generateOutline(
    PROMPT,
    () => {},
    () => {},
    () => {},
    params,
    () => {},
  );
  /*
   * 注意：抹掉**大纲**里的 layout 并不等于走兜底。
   *
   * 第一版就是这么写的，结果 12/12 页全是 points——因为逐页展开时模型会自己再写一个 layout
   * （不给提示就默认 points），deriveLayout 根本没被调用。兜底路径见脚本末尾的 dry-run（直接把分镜页
   的 layout 拿掉再过一遍 normalize）。
   */
  const storyboard = await generateFromPlan(
    PROMPT,
    plan,
    params,
    () => {},
    () => {},
    undefined,
    () => {},
    () => {},
  );
  const layouts = storyboard.pages.map((p) => String(p.layout ?? "?"));
  perRound.push(layouts);
  for (const l of layouts) histogram.set(l, (histogram.get(l) ?? 0) + 1);
  for (const p of plan.pages ?? []) {
    planned += 1;
    const l = String((p as { layout?: string }).layout ?? "");
    if (!l || !known.has(l)) derived += 1;
  }
  console.log(`完成（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  console.log(
    `  大纲版式：${(plan.pages ?? []).map((p) => String((p as { layout?: string }).layout ?? "—")).join(" ")}`,
  );
  console.log(`  实际版式：${layouts.join(" ")}`);
}

console.log("\n===== 版式分布 =====");
const rows = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
const total = rows.reduce((a, [, n]) => a + n, 0);
for (const [layout, n] of rows) {
  const bar = "█".repeat(Math.max(1, Math.round((n / total) * 30)));
  console.log(
    `${layout.padEnd(14)} ${String(n).padStart(3)}  ${String(Math.round((n / total) * 100)).padStart(3)}%  ${bar}`,
  );
}
const single = rows.length === 1;
console.log(
  `\n合计 ${ROUNDS} 轮 ${total} 页，用到的版式 ${rows.length} 种；` +
    `大纲未给版式（走 deriveLayout 兜底）${derived}/${planned} 页。`,
);
if (single) console.log("!! 整片只剩一种版式，兜底没生效或模型在偷懒 —— 看上面的实际版式行");
if (perRound.some((r) => new Set(r).size === 1)) console.log("!! 有某一轮整片只用了一种版式");

/*
 * 兜底（deriveLayout）的预演：把分镜页的 layout 拿掉，直接过 normalizeDirect。
 *
 * 这才是用户真正会碰到的兜底场景（web 端导入手写分镜、旧版 JSON、
 * 模型漏写 layout）。它不调模型，因此可重复、不花钱。
 */
{
  const samplePath = path.join(repoRoot, "server", "out", "e2e", "storyboard.json");
  const raw = JSON.parse(readFileSync(samplePath, "utf-8")) as { storyboard?: { pages?: Record<string, unknown>[] } };
  const pages = raw.storyboard?.pages ?? [];
  for (const pg of pages) {
    for (const k of ["layout", "art", "chart", "table"]) delete pg[k];
  }
  const derivedSb = normalizeDirect({ pages, theme: params.theme });
  const derivedLayouts = derivedSb.pages.map((p) => String(p.layout));
  const hist = new Map<string, number>();
  for (const l of derivedLayouts) hist.set(l, (hist.get(l) ?? 0) + 1);
  console.log(`\n===== 兜底预演（拿掉 layout 后过 normalizeDirect，${pages.length} 页）=====`);
  console.log(`  ${derivedLayouts.join(" ")}`);
  console.log(`  用到 ${hist.size} 种版式：${[...hist].map(([k, v]) => `${k}×${v}`).join("，")}`);
}
