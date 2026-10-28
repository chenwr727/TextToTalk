/**
 * 把 `samples/code-page.tsx` 转译成 `samples/code-page.mjs` 里的 JS 字符串。
 *
 * 转译选项与 `server/src/services/codePage.ts` 生产链路保持逐字一致（jsx: React、
 * module: CommonJS、target: ES2020），这样 gallery 里看到的 `code` 版式就是
 * 真实生成页面会走的那条路，而不是"手写一份看着像的 JS"。
 *
 * 用法：node server/scripts/build-sample-code.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, "samples", "code-page.tsx");
const outPath = join(here, "samples", "code-page.mjs");

const source = readFileSync(srcPath, "utf8");
const { outputText, diagnostics } = ts.transpileModule(source, {
  reportDiagnostics: true,
  compilerOptions: {
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    // 样本里的中文注释是给维护者看的，转译产物不需要
    removeComments: true,
  },
});

const fatal = (diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
if (fatal.length) {
  console.error("[sample-code] 转译失败：");
  for (const d of fatal) console.error("  " + ts.flattenDiagnosticMessageText(d.messageText, " "));
  process.exit(1);
}
if (!/exports\.default/.test(outputText)) {
  console.error("[sample-code] 产物里没有 exports.default，GeneratedPage 会降级成 points");
  process.exit(1);
}

// 模板字面量里若出现反引号或 ${ 会被提前求值，这种情况退回 JSON 字符串（丑但安全）
const clean = !outputText.includes("`") && !outputText.includes("${");
const body = clean ? `String.raw\`\n${outputText}\`` : JSON.stringify(outputText);

writeFileSync(
  outPath,
  `/**
 * 自动生成，请勿手改 —— 源头是 samples/code-page.tsx，
 * 由 node server/scripts/build-sample-code.mjs 用与生产一致的转译选项产出。
 */
export const CODE_PAGE_JS = ${body};
`,
  "utf8",
);
console.log(`[sample-code] 写出 ${outPath}（${outputText.length} 字符，${clean ? "模板字面量" : "JSON 转义"}）`);
