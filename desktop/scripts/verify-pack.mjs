import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "release", "win-unpacked");

const res = path.join(target, "resources");

const REQUIRED = [
  ["portable.txt", "免安装模式标记（extraFiles）"],
  ["resources/app.asar", "桌面端主程序（asar）"],
  ["resources/bin/ffmpeg.exe", "内置 ffmpeg（配音转码）"],
  ["resources/web/index.html", "前端静态产物"],
  ["resources/server/src/index.ts", "后端入口"],
  ["resources/server/tts.config.json", "TTS 引擎/音色配置"],
  ["resources/server/node_modules/tsx/dist/cli.mjs", "后端启动器 tsx"],
  ["resources/server/node_modules/fastify/package.json", "后端依赖 fastify"],
  ["resources/server/node_modules/msedge-tts/package.json", "后端依赖 msedge-tts"],
  ["resources/server/node_modules/playwright-core/package.json", "后端依赖 playwright-core（网页抓取）"],
  ["resources/server/render/out/bundle/index.html", "Remotion 预打包场景 bundle"],
  ["resources/server/render/run-render.mjs", "Remotion 运行时渲染 runner"],
  ["resources/server/render/node_modules/@remotion/renderer/package.json", "Remotion 渲染引擎"],
  ["resources/server/render/src/DynamicVideo.tsx", "Remotion 主组件"],
  ["resources/server/render/src/shared/render/props.ts", "Remotion 共享类型"],
];

const FORBIDDEN = [
  ["server/out", "成片输出目录"],
  ["server/data", "数据目录"],
  ["server/render-profile", "渲染临时 profile"],
  ["server/assets/tts", "TTS 缓存音频"],
  ["server/assets/bgm", "BGM 缓存音频"],
  ["server/render/src/gen", "历史任务生成的 Remotion 入口"],
];

let failed = 0;

console.log(`校验目录：${target}\n`);
console.log("必需项（相对 win-unpacked）：");
for (const [rel, desc] of REQUIRED) {
  const ok = fs.existsSync(path.join(target, rel));
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗ 缺失"}  ${rel.padEnd(50)} ${desc}`);
}

console.log("\n排除项（不应存在，相对 resources）：");
for (const [rel, desc] of FORBIDDEN) {
  const exists = fs.existsSync(path.join(res, rel));
  if (exists) failed++;
  console.log(`  ${exists ? "✗ 仍存在" : "✓ 已排除"}  ${rel.padEnd(42)} ${desc}`);
}

console.log("\nresources 各目录体积：");
if (fs.existsSync(res)) {
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
  for (const e of fs.readdirSync(res, { withFileTypes: true })) {
    const p = path.join(res, e.name);
    const size = e.isDirectory() ? walk(p) : fs.statSync(p).size;
    console.log(`  ${(size / 1048576).toFixed(1).padStart(8)} MB  ${e.name}`);
  }
}

const releaseDir = path.join(root, "release");
if (fs.existsSync(releaseDir)) {
  console.log("\n产出物：");
  for (const e of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const size = fs.statSync(path.join(releaseDir, e.name)).size;
    console.log(`  ${(size / 1048576).toFixed(1).padStart(8)} MB  ${e.name}`);
  }
}

console.log(failed === 0 ? "\n打包自检通过" : `\n打包自检失败：${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
