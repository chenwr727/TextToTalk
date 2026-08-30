import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const src = path.join(repoRoot, "server");
const destRoot = path.join(here, "..", "build", "resources", "payload");
const dest = path.join(destRoot, "server");

const EXCLUDE_DIRS = [
  "out",
  "data",
  "render-profile",
  "assets/tts",
  "assets/bgm",
  "render/src/gen",
  "node_modules",
];

if (!fs.existsSync(src)) {
  console.error(`找不到后端目录：${src}`);
  process.exit(1);
}

try {
  fs.rmSync(dest, { recursive: true, force: true });
} catch (e) {
  console.warn(`[stage] 清空旧暂存目录失败，改为覆盖写入：${(e && e.message) || e}`);
}
fs.mkdirSync(dest, { recursive: true });

const norm = (p) => p.split(path.sep).join("/");
let skipped = 0;

fs.cpSync(src, dest, {
  recursive: true,
  dereference: false,
  filter(source) {
    const rel = norm(path.relative(src, source));
    if (!rel) return true;
    for (const ex of EXCLUDE_DIRS) {
      if (rel === ex || rel.startsWith(ex + "/")) {
        skipped++;
        return false;
      }
    }
    if (path.basename(source) === ".remotion") return false;
    if (path.basename(source) === ".cache" && rel.includes("node_modules/")) return false;
    return true;
  },
});

console.log(`[stage] 已复制 server（跳过 ${skipped} 个运行时产物路径）`);

for (const f of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
  const s = path.join(src, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dest, f));
}

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const inst = spawnSync(
  pnpmBin,
  ["install", "--node-linker=hoisted", "--ignore-scripts", "--prod=false"],
  { cwd: dest, encoding: "utf-8", shell: process.platform === "win32" },
);

if (inst.status !== 0) {
  console.error("[stage] 依赖安装失败：\n" + (inst.stdout || "") + "\n" + (inst.stderr || ""));
  process.exit(1);
}
console.log("[stage] 已重装 server 依赖（hoisted，无符号链接）");

const walk = (d) => {
  let s = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    try {
      if (e.isDirectory()) s += walk(p);
      else s += fs.statSync(p).size;
    } catch {}
  }
  return s;
};

const must = [
  "src/index.ts",
  "node_modules/tsx/dist/cli.mjs",
  "node_modules/fastify/package.json",
  "node_modules/@fastify/cors/package.json",
  "node_modules/msedge-tts/package.json",
  "render/node_modules/.bin/remotion.cmd",
  "render/node_modules/@esbuild/win32-x64/esbuild.exe",
  "render/src/DynamicVideo.tsx",
  "render/src/shared/render/props.ts",
];
const missing = must.filter((m) => !fs.existsSync(path.join(dest, m)));

let symlinks = 0;
const nm = path.join(dest, "node_modules");
if (fs.existsSync(nm)) {
  for (const e of fs.readdirSync(nm, { withFileTypes: true })) {
    try {
      if (fs.lstatSync(path.join(nm, e.name)).isSymbolicLink()) symlinks++;
    } catch {}
  }
}

console.log(`[stage] 体积 ${(walk(dest) / 1048576).toFixed(1)} MB，顶层符号链接 ${symlinks} 个`);

if (symlinks > 0) {
  console.error("[stage] server/node_modules 存在符号链接，打包后会失效");
  process.exit(1);
}
if (missing.length) {
  console.error("[stage] 暂存后端缺少关键文件：\n  " + missing.join("\n  "));
  process.exit(1);
}
console.log("[stage] 自检通过 -> " + dest);
