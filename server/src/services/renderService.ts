import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchTask, getTask } from "./taskStore.js";
import { generateTts, type TtsSentence } from "./ttsService.js";
import { generateBgm } from "./bgmService.js";
import { writeRenderEntry } from "./entry.js";
import { enqueueRender } from "./renderQueue.js";
import { renderPageFrames } from "./frameExtract.js";
import type { Storyboard } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");
export const OUT_DIR = path.join(serverRoot, "out");
const RENDER_DIR = path.join(serverRoot, "render");

mkdirSync(OUT_DIR, { recursive: true });

export async function renderTaskSync(
  taskId: string,
  storyboard: Storyboard,
  fps: number,
  subtitles: boolean,
  useBgm: boolean,
  onProgress?: (p: number) => void,
  onWarning?: (w: string) => void,
  opts?: { theme?: string; width?: number; height?: number; voice?: string }
): Promise<string> {
  const setStage = (p: number) => onProgress?.(Math.min(0.98, p));

  setStage(0.02);
  const tts = await generateTts(taskId, storyboard, opts?.voice);
  if (tts.failedCount > 0) {
    onWarning?.(`有 ${tts.failedCount}/${storyboard.pages.reduce((a, p) => a + p.captions.length, 0)} 句配音合成失败，成片中对应字幕将无旁白，可尝试重新渲染或微调字幕后再试。`);
  }
  const totalSeconds = tts.pages.reduce((a, p) => a + (p.totalSeconds || 0), 0);
  setStage(0.05);

  const bgm = useBgm ? await generateBgm(taskId, Math.max(3, totalSeconds)) : null;
  setStage(0.1);

  const pages = storyboard.pages.map((p) => {
    const t = tts.pages.find((x) => x.index === p.pageIndex);
    let sentences: TtsSentence[] | undefined;
    if (t) {
      sentences = [];
      let si = 0;
      for (const c of p.captions) {
        if (si < t.sentences.length && t.sentences[si].text === c) {
          sentences.push(t.sentences[si]);
          si++;
        } else {
          sentences.push({ text: c, seconds: Math.max(2, Math.ceil(c.length / 5 + 1)), audioUrl: "" });
        }
      }
    }
    return { ...p, sentences };
  });

  const entryName = `gen_${taskId}`;
  writeRenderEntry(taskId, storyboard, pages, fps, subtitles, bgm, entryName, opts);
  setStage(0.12);
  const output = path.join(OUT_DIR, `${taskId}.mp4`);

  const userDataDir = path.join(OUT_DIR, "..", "render-profile", taskId);
  mkdirSync(userDataDir, { recursive: true });
  const gl = process.env.RENDER_GL || "swiftshader";
  const args = [
    "render",
    `src/gen/${entryName}.tsx`, "DynamicVideo", output,
    "--log=warn",
    `--gl=${gl}`,
  ];
  const conc = Number(process.env.RENDER_CONCURRENCY || Math.max(1, Math.round(cpus().length / 2)));
  if (Number.isFinite(conc) && conc > 0) args.push(`--concurrency=${conc}`);
  const scale = Number(process.env.RENDER_SCALE);
  if (Number.isFinite(scale) && scale > 0 && scale <= 1) args.push(`--scale=${scale}`);
  if (process.env.RENDER_HW_ACCEL === "1") {
    args.push("--hardware-acceleration=if-possible");
  } else {
    args.push(`--x264-preset=${process.env.RENDER_X264_PRESET || "veryfast"}`);
  }
  const systemBrowser = process.env.CHROME_PATH || null;
  if (systemBrowser) {
    console.log("[render] 使用 CHROME_PATH 指定的浏览器:", systemBrowser);
    args.push("--browser-executable", systemBrowser);
  } else {
    console.log("[render] 未设置 CHROME_PATH，将使用 Remotion 自带的 Headless Shell");
  }
  args.push("--user-data-dir", userDataDir);
  console.log("[render] browser:", systemBrowser || "(none, will download Headless Shell)");
  console.log("[render] user-data-dir:", userDataDir);
  console.log("[render] spawn remotion for task", taskId, "args:", args.join(" "));
  const binName = process.platform === "win32" ? "remotion.cmd" : "remotion";
  const remotionBin = path.join(RENDER_DIR, "node_modules", ".bin", binName);
  const cmdLine = [remotionBin, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");

  await new Promise<string>((resolve, reject) => {
    const child = spawn(cmdLine, {
      cwd: RENDER_DIR,
      env: { ...process.env },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const progressRe =
      /(?:Rendering|Rendered|Stitching|Encoding)\s+(?:still|stills|frames?)?\s*[^\d]*?(\d+)\s*\/\s*(\d+)/gi;
    const onStdout = (chunk: Buffer) => {
      if (!onProgress) return;
      let m: RegExpExecArray | null;
      let last = 0;
      progressRe.lastIndex = 0;
      const text = chunk.toString();
      while ((m = progressRe.exec(text)) !== null) {
        const done = Number(m[1]);
        const total = Number(m[2]);
        if (total > 0) last = Math.min(0.98, 0.12 + (done / total) * 0.86);
      }
      if (last > 0) onProgress(last);
    };
    const onStderr = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.trim()) console.error("[render][remotion]", text.trim());
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.on("error", (e2) => reject(e2));
    child.on("close", (code) => {
      try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
      if (code === 0) resolve(output);
      else reject(new Error("Remotion 渲染退出码 " + code + "，详见上方 [render][remotion] 日志"));
    });
  });

  try {
    await renderPageFrames(taskId, storyboard, pages, fps || 30, onProgress);
  } catch (e) {
    console.warn("[render] 抽帧缩略图失败（不影响成片）:", e);
  }
  return output;
}

export function renderTaskInBackground(taskId: string): void {
  const task = getTask(taskId);
  if (!task || !task.storyboard) {
    patchTask(taskId, { status: "FAILED", error: "storyboard 未就绪" });
    return;
  }
  const storyboard = task.storyboard;
  const { fps, subtitles, bgm, theme, width, height, voice } = task.params;
  enqueueRender(taskId, async () => {
    patchTask(taskId, { warning: null });
    try {
      const outPath = await renderTaskSync(
        taskId, storyboard, fps || 30, subtitles !== false,
        bgm === "default",
        (p) => patchTask(taskId, { progress: p }),
        (w) => patchTask(taskId, { warning: w }),
        { theme, width, height, voice }
      );
      patchTask(taskId, { status: "DONE", progress: 1, outputUrl: `/download/${taskId}` });
      console.log("[render] done ->", outPath);
    } catch (e) {
      patchTask(taskId, { status: "FAILED", error: String(e) });
      console.error("[render] failed", e);
    }
  });
}