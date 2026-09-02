import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";

const WINDOWS_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findSystemBrowser() {
  if (process.platform === "win32") {
    const userCandidates = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    ].filter(Boolean);
    for (const p of [...WINDOWS_CANDIDATES, ...userCandidates]) {
      if (exists(p)) return p;
    }
  } else if (process.platform === "darwin") {
    for (const p of [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]) {
      if (exists(p)) return p;
    }
  } else {
    for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      for (const dir of ["/usr/bin", "/usr/local/bin"]) {
        const p = path.join(dir, bin);
        if (exists(p)) return p;
      }
    }
  }
  return null;
}

function commandPath(cmd) {
  return new Promise((resolve) => {
    const check = process.platform === "win32" ? "where" : "which";
    execFile(check, [cmd], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const first = String(stdout).split(/\r?\n/)[0]?.trim();
      resolve(first || null);
    });
  });
}

async function resolveBrowser() {
  if (process.env.CHROME_PATH && process.env.CHROME_PATH.trim()) return process.env.CHROME_PATH.trim();
  if (process.env.REMOTION_BROWSER_EXECUTABLE && process.env.REMOTION_BROWSER_EXECUTABLE.trim()) {
    return process.env.REMOTION_BROWSER_EXECUTABLE.trim();
  }
  const found = findSystemBrowser();
  if (found) return found;
  for (const cmd of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge"]) {
    const p = await commandPath(cmd);
    if (p) return p;
  }
  return null;
}

const configPath = process.argv[2];
if (!configPath) {
  console.error("run-render.mjs: 缺少配置文件参数");
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const {
  mode = "video",
  serveUrl,
  compositionId = "DynamicVideo",
  output,
  inputProps = {},
  frame = 0,
  options = {},
} = config;

if (!serveUrl || !output) {
  console.error("run-render.mjs: 配置缺少 serveUrl / output");
  process.exit(2);
}

const chromiumOptions = { gl: process.env.RENDER_GL || options.gl || "swiftshader" };

async function main() {
  const browserExecutable = await resolveBrowser();
  console.log(
    browserExecutable
      ? `[render] 使用浏览器: ${browserExecutable}`
      : "[render] 未找到系统浏览器，将使用 Remotion 内置 Headless Shell"
  );
  const compositions = await getCompositions({
    serveUrl,
    inputProps,
    browserExecutable,
    chromiumOptions,
  });
  const composition = compositions.find((c) => c.id === compositionId);
  if (!composition) {
    throw new Error(
      `找不到 composition "${compositionId}"，可用: ${compositions.map((c) => c.id).join(", ")}`
    );
  }

  if (mode === "still") {
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      frame: Number(frame) || 0,
      output,
      browserExecutable,
      chromiumOptions,
    });
    console.log("Rendered still 1/1");
    return;
  }

  const conc = Number(options.concurrency);
  const scale = Number(options.scale);
  let lastPrint = 0;
  if (!output) {
    console.error("run-render.mjs: video 模式缺少 output");
    process.exit(2);
  }
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    outputLocation: output,
    codec: options.codec || "h264",
    browserExecutable,
    chromiumOptions,
    logLevel: "warn",
    forceIPv4: options.forceIPv4 !== false,
    concurrency: Number.isFinite(conc) && conc > 0 ? conc : undefined,
    scale: Number.isFinite(scale) && scale > 0 ? scale : undefined,
    x264Preset: options.x264Preset || undefined,
    hardwareAcceleration: options.hardwareAcceleration || undefined,
    onProgress: ({ renderedFrames }) => {
      const totalFrames = composition.durationInFrames;
      const now = Date.now();
      if (now - lastPrint > 500 || renderedFrames >= totalFrames) {
        lastPrint = now;
        console.log(`Rendered ${renderedFrames}/${totalFrames}`);
      }
    },
  });
  console.log(`Encoded ${composition.durationInFrames}/${composition.durationInFrames}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? (e.stack || e.message) : String(e));
  process.exit(1);
});
