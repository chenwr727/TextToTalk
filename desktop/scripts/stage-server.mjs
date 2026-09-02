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
  "render/out",
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
    if (path.basename(source) === "node_modules") {
      skipped++;
      return false;
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
const renderDest = path.join(dest, "render");
const runPnpm = (cwd, extraArgs, label) => {
  console.log(`[stage] ${label} ...`);
  const baseArgs = [
    "install",
    "--node-linker=hoisted",
    "--ignore-scripts",
    "--prefer-offline",
    "--network-concurrency=4",
    "--fetch-retries=5",
    "--fetch-timeout=60000",
    ...extraArgs,
  ];
  const isWin = process.platform === "win32";
  const r = isWin
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", [pnpmBin, ...baseArgs].join(" ")], {
        cwd,
        encoding: "utf-8",
        shell: false,
      })
    : spawnSync(pnpmBin, baseArgs, { cwd, encoding: "utf-8", shell: false });
  if (r.status !== 0) {
    console.error(`[stage] ${label} 失败：\n` + (r.stdout || "") + "\n" + (r.stderr || ""));
    process.exit(1);
  }
};

const rmTree = (dir) => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (!fs.existsSync(dir)) return;
    if (process.platform === "win32") {
      spawnSync("cmd.exe", ["/c", "rmdir", "/s", "/q", dir], { encoding: "utf-8" });
    }
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      } catch {}
    }
    if (!fs.existsSync(dir)) return;
    if (attempt < 5) {
      console.warn(`[stage] 删除 ${dir} 失败（第 ${attempt} 次），等待后重试...`);
      spawnSync("cmd.exe", ["/c", "ping", "-n", "2", "127.0.0.1"], { encoding: "utf-8", stdio: "ignore" });
    }
  }
  console.error(`[stage] 无法删除 ${dir}（可能被占用），中止打包以避免产出体积异常的安装包`);
  process.exit(1);
};
rmTree(path.join(dest, "node_modules"));
rmTree(path.join(renderDest, "node_modules"));

runPnpm(dest, ["--prod=false", "--force"], "安装 server 依赖（全量）");
runPnpm(renderDest, ["--prod=false", "--force"], "安装 render 依赖（全量）");

for (const probe of [
  path.join(renderDest, "node_modules", "@remotion", "bundler", "package.json"),
  path.join(renderDest, "node_modules", "react", "package.json"),
]) {
  if (!fs.existsSync(probe)) {
    console.error(`[stage] 全量安装后缺少 ${probe}，无法预打包场景`);
    process.exit(1);
  }
}

const bundleRes = spawnSync(process.execPath, ["scripts/bundle.mjs"], {
  cwd: renderDest,
  encoding: "utf-8",
});
if (bundleRes.stdout) console.log(bundleRes.stdout.trim());
if (bundleRes.status !== 0) {
  console.error("[stage] Remotion 场景预打包失败：\n" + (bundleRes.stderr || bundleRes.stdout || ""));
  process.exit(1);
}

rmTree(path.join(dest, "node_modules"));
rmTree(path.join(renderDest, "node_modules"));
runPnpm(dest, ["--prod"], "重装 server 依赖（生产）");
runPnpm(renderDest, ["--prod"], "重装 render 依赖（生产）");
console.log("[stage] 已安装生产依赖（构建工具链与 devDependencies 已剔除）");

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
  "node_modules/playwright-core/package.json",
  "render/run-render.mjs",
  "render/scripts/bundle.mjs",
  "render/src/index.ts",
  "render/src/DynamicVideo.tsx",
  "render/src/shared/render/props.ts",
  "render/out/bundle/index.html",
  "render/node_modules/@remotion/renderer/package.json",
  "render/node_modules/remotion/package.json",
];
const missing = must.filter((m) => !fs.existsSync(path.join(dest, m)));

let symlinks = 0;
for (const nm of [path.join(dest, "node_modules"), path.join(renderDest, "node_modules")]) {
  if (!fs.existsSync(nm)) continue;
  for (const e of fs.readdirSync(nm, { withFileTypes: true })) {
    try {
      if (fs.lstatSync(path.join(nm, e.name)).isSymbolicLink()) symlinks++;
    } catch {}
  }
}

console.log(`[stage] 体积 ${(walk(dest) / 1048576).toFixed(1)} MB，顶层符号链接 ${symlinks} 个`);

if (symlinks > 0) {
  console.error("[stage] node_modules 存在符号链接，打包后会失效");
  process.exit(1);
}
if (missing.length) {
  console.error("[stage] 暂存后端缺少关键文件：\n  " + missing.join("\n  "));
  process.exit(1);
}
console.log("[stage] 自检通过 -> " + dest);
