import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "build", "bin");

function resolveFfmpeg() {
  try {
    return require("ffmpeg-static");
  } catch {
    return null;
  }
}

const src = resolveFfmpeg();
if (!src || typeof src !== "string" || !fs.existsSync(src)) {
  console.error("[ffmpeg] 未找到 ffmpeg-static 二进制，请先执行 npm install");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, path.basename(src));
fs.copyFileSync(src, target);
if (process.platform !== "win32") fs.chmodSync(target, 0o755);

console.log(`[ffmpeg] 已复制 ${path.basename(src)} (${(fs.statSync(target).size / 1048576).toFixed(1)} MB) -> ${outDir}`);
