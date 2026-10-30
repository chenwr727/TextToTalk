/**
 * 真实端到端生成：跑一次完整的「大纲 → 分镜」链路，把结果落盘供出图核对。
 *
 * 用法（仓库根目录）：
 *   node --import tsx server/scripts/e2e-generate.mjs --prompt "文案" [--portrait] [--out 文件名]
 *
 * 环境变量（也可写在 .env 里）：
 *   LLM_API_URL  默认 http://127.0.0.1:8001/v1/chat/completions
 *   LLM_API_KEY  必填
 *   LLM_MODEL    默认 deepseek
 *
 * 产物：server/out/e2e/<out>.json —— { params, plan, storyboard }
 *
 * 为什么要单独一个脚本：`code` 版式（AI 直接写 React 组件）的行为只有真跑模型才看得到，
 * 而这个能力最近刚加了"竖屏契约"（props 里有 portrait / width / height，
 * 且要求别写死横向宽度）。这里就是为了回答"模型到底有没有照着写"。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateStoryboard } from "../src/services/storyboardGenerator.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.join(repoRoot, "server", "out", "e2e");

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const prompt = argOf(
  "prompt",
  "为什么组织越管越僵：从外到内的四层洋葱模型。外层是审批流程，往里是部门墙，第三层是信息不对称，核心是没人敢说真话。",
);
const portrait = flag("portrait");
const outName = argOf("out", portrait ? "portrait" : "landscape");

const params = {
  width: portrait ? 1080 : 1920,
  height: portrait ? 1920 : 1080,
  fps: 30,
  tone: "casual",
  narration: true,
  subtitles: true,
  bgm: "none",
  granularity: "medium",
  theme: "tech",
};

const stage = (s) => console.log(`[e2e] ${s}`);

const t0 = Date.now();
const { storyboard, plan } = await generateStoryboard(prompt, params, undefined, stage);
const pages = storyboard.pages ?? [];
stage(`完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s，共 ${pages.length} 页`);

console.log("\n页序：");
for (const [i, p] of pages.entries()) {
  const kind = p.chart?.type ? `chart:${p.chart.type}` : p.art ? `art:${p.art}` : p.layout;
  const code = p.code ? ` code=${p.code.length}字` : "";
  console.log(`  ${String(i + 1).padStart(2)}. ${String(kind).padEnd(14)} ${p.title}${code}`);
}

const codePages = pages.filter((p) => p.code);
console.log(`\ncode 页：${codePages.length} 个`);
for (const [i, p] of codePages.entries()) {
  const src = p.code ?? "";
  const usesPortrait = /\bportrait\b/.test(src);
  const usesFlexWrap = /flexWrap/.test(src);
  const hardcodedW = /width:\s*\d{3,4}\b/.test(src) && !/maxWidth/.test(src);
  console.log(`\n--- code 页 ${i + 1}：${p.title} ---`);
  console.log(
    `  用到 portrait: ${usesPortrait ? "是" : "否"} | flexWrap: ${usesFlexWrap ? "是" : "否"} | 写死宽度: ${hardcodedW ? "疑似" : "否"}`,
  );
  console.log(src.split("\n").slice(0, 24).join("\n"));
}

mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${outName}.json`);
writeFileSync(outPath, JSON.stringify({ params, plan, storyboard }, null, 2), "utf8");
stage(`落盘 ${outPath}`);
