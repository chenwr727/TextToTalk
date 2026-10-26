import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderDir = path.resolve(here, "..");
const entryPoint = path.join(renderDir, "src", "index.ts");
const outDir = path.join(renderDir, "out", "bundle");
const publicDir = path.join(renderDir, "public");

const { bundle } = await import("@remotion/bundler");

fs.rmSync(outDir, { recursive: true, force: true });

console.log("[bundle] 打包", entryPoint);
await bundle({
  entryPoint,
  outDir,
  // publicDir 让 staticFile("fonts/…") 能取到 display 字体（缺目录时 Remotion 会忽略）
  publicDir: fs.existsSync(publicDir) ? publicDir : null,
  webpackOverride: (config) => config,
});

if (!fs.existsSync(path.join(outDir, "index.html"))) {
  console.error("[bundle] 失败：未生成 out/bundle/index.html");
  process.exit(1);
}
console.log("[bundle] 完成 ->", outDir);
