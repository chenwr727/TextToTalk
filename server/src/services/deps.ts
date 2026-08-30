import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface RenderDeps {
  ok: boolean;
  ffmpeg: boolean;
  chrome: boolean | null;
  missing: ("ffmpeg" | "chrome")[];
  binDir: string;
}

let ffmpegCache: boolean | null = null;

export function hasFfmpeg(): Promise<boolean> {
  if (ffmpegCache !== null) return Promise.resolve(ffmpegCache);
  return new Promise((resolve) => {
    const child = execFile("ffmpeg", ["-version"], { timeout: 8000, windowsHide: true }, (err) => {
      ffmpegCache = !err;
      resolve(ffmpegCache);
    });
    child.on("error", () => {
      ffmpegCache = false;
      resolve(false);
    });
  });
}

export async function checkRenderDeps(): Promise<RenderDeps> {
  const binDir = process.env.TTT_BIN_DIR || "";
  const ffmpeg = await hasFfmpeg();

  const chromeEnv = process.env.TTT_CHROME_AVAILABLE;
  const hasChromePath = Boolean(process.env.CHROME_PATH || process.env.REMOTION_BROWSER_EXECUTABLE);
  let chrome: boolean | null;
  if (hasChromePath) chrome = true;
  else if (chromeEnv === "0") chrome = false;
  else chrome = null;

  const missing: ("ffmpeg" | "chrome")[] = [];
  if (!ffmpeg) missing.push("ffmpeg");
  if (chrome === false) missing.push("chrome");

  return { ok: missing.length === 0, ffmpeg, chrome, missing, binDir };
}

export function describeMissingDeps(deps: RenderDeps): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  const parts: string[] = [];

  if (!deps.ffmpeg) {
    parts.push(
      `未检测到 ffmpeg，无法把配音转成成片需要的音频格式。\n` +
        `请把 ffmpeg${ext} 放到下面的目录后重启应用：\n${deps.binDir || "<应用安装目录>/resources/bin"}`,
    );
  }
  if (deps.chrome === false) {
    parts.push(
      "未检测到 Chromium 内核（Edge / Chrome），无法渲染画面。\n" +
        "请在「设置 → 渲染」里手动指定浏览器路径，或安装 Edge / Chrome 后重启应用。",
    );
  }

  return parts.join("\n\n");
}

export function wavDurationSeconds(file: string): number | null {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(4096);
      fs.readSync(fd, buf, 0, 4096, 0);
      if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;

      let offset = 12;
      let byteRate = 0;
      let dataSize = 0;
      let gotFmt = false;
      let gotData = false;

      while (offset + 8 <= buf.length) {
        const id = buf.toString("ascii", offset, offset + 4);
        const size = buf.readUInt32LE(offset + 4);
        const body = offset + 8;

        if (id === "fmt " && body + 16 <= buf.length) {
          const channels = buf.readUInt16LE(body + 2);
          const sampleRate = buf.readUInt32LE(body + 4);
          const blockAlign = buf.readUInt16LE(body + 12);
          const bits = buf.readUInt16LE(body + 14);
          byteRate = buf.readUInt32LE(body + 8);
          if (byteRate <= 0) {
            const align = blockAlign > 0 ? blockAlign : Math.max(1, (channels || 1) * Math.ceil((bits || 16) / 8));
            byteRate = (sampleRate || 0) * align;
          }
          gotFmt = true;
        } else if (id === "data") {
          dataSize = size > 0 ? size : Math.max(0, fs.statSync(file).size - body);
          gotData = true;
        }

        if (gotFmt && gotData) break;
        if (size === 0) break;
        offset = body + size + (size % 2);
      }

      if (!gotFmt || !gotData || byteRate <= 0) return null;
      return dataSize / byteRate;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

export function applyBinDirToPath(): void {
  const dir = process.env.TTT_BIN_DIR;
  if (!dir || !fs.existsSync(dir)) return;
  const sep = path.delimiter;
  if (!(process.env.PATH || "").split(sep).includes(dir)) {
    process.env.PATH = `${dir}${sep}${process.env.PATH ?? ""}`;
  }
}
