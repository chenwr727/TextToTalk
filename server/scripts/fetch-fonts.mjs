/**
 * 下载渲染用的 display 字体到 server/render/public/fonts/。
 *
 * 为什么不用 @remotion/google-fonts 在渲染时现拉：渲染是本地/离线的确定性流程，
 * 每次出片都依赖外网会带来"某天字体悄悄回退成系统黑体"的问题。这里一次性下载入库，
 * 渲染时只读本地文件，缺了也只是回退系统字体、不报错。
 *
 * 用法：node scripts/fetch-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..", "render", "public", "fonts");

// 只取标题/大字用的粗体。正文继续用系统字体栈：中文正文字体文件太大，
// 而标题的字体差异恰恰是"设计过 vs 没设计过"最明显的地方。
const FAMILIES = [
  { family: "Noto Sans SC", weight: 700, slug: "cjk-sans-700", alias: "TTT CJK" },
  { family: "Sora", weight: 700, slug: "latin-display-700", alias: "TTT Display" },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const fetchText = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

const main = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  for (const f of FAMILIES) {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, "+")}:wght@${f.weight}&display=block`;
    process.stdout.write(`[fonts] ${f.family} ${f.weight} … `);
    const css = await fetchText(cssUrl);

    // 中文字体会被切成上百个 unicode-range 子集，逐个下载后按 range 原样登记，
    // 浏览器只会取用到的那几个子集，这也是 Google 官方做 CJK 的方式。
    const blocks = css.match(/@font-face\s*{[\s\S]*?}/g) ?? [];
    const files = [];
    let i = 0;
    for (const block of blocks) {
      const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!url) continue;
      const range = block.match(/unicode-range:\s*([^;}]+)/)?.[1]?.trim();
      const name = `${f.slug}-${i++}.woff2`;
      const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
      fs.writeFileSync(path.join(outDir, name), buf);
      files.push({ src: name, unicodeRange: range });
    }
    const total = files.reduce((a, x) => a + fs.statSync(path.join(outDir, x.src)).size, 0);
    console.log(`${files.length} 个子集 / ${(total / 1024 / 1024).toFixed(2)} MB`);
    manifest.push({ alias: f.alias, family: f.family, weight: f.weight, files });
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ families: manifest }, null, 2));
  const all = fs
    .readdirSync(outDir)
    .filter((n) => n.endsWith(".woff2"))
    .reduce((a, n) => a + fs.statSync(path.join(outDir, n)).size, 0);
  console.log(`[fonts] 完成，共 ${(all / 1024 / 1024).toFixed(2)} MB -> ${outDir}`);
};

main().catch((e) => {
  console.error("[fonts] 失败：", e.message);
  process.exit(1);
});
