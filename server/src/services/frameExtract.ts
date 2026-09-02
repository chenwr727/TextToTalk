import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Storyboard } from "../types.js";
import type { TtsSentence } from "./ttsService.js";
import { outDir, renderDir } from "./runtime.js";
import { spawnRunner } from "./remotionRun.js";

const RENDER_DIR = renderDir;

export type FramePage = Storyboard["pages"][number] & { sentences?: TtsSentence[] };

const TRANSITION_FRAMES = 12;

function pageDuration(p: FramePage, fps: number): number {
  return p.sentences && p.sentences.length
    ? p.sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * (fps || 30))), 0)
    : Math.round((p.durationSec || 4) * (fps || 30));
}

export function pageStartFrames(pages: FramePage[], fps: number): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (let i = 0; i < pages.length; i++) {
    offsets.push(offset);
    offset += pageDuration(pages[i], fps) - (i < pages.length - 1 ? TRANSITION_FRAMES : 0);
  }
  return offsets;
}

export function previewCaptureFrames(pages: FramePage[], fps: number): number[] {
  const offsets = pageStartFrames(pages, fps);
  return offsets.map((start, i) => {
    const dur = pageDuration(pages[i], fps);
    const settle = Math.min(Math.max(24, Math.round(dur * 0.3)), Math.max(1, dur - TRANSITION_FRAMES - 2));
    return start + Math.min(TRANSITION_FRAMES + settle, Math.max(1, dur - 1));
  });
}

export async function renderPageFrames(
  taskId: string,
  storyboard: Storyboard,
  pages: FramePage[],
  fps: number,
  onProgress?: (p: number) => void,
  opts?: { theme?: string; width?: number; height?: number }
): Promise<string[]> {
  const framesDir = path.join(outDir, taskId, "frames");
  mkdirSync(framesDir, { recursive: true });
  const captures = previewCaptureFrames(pages, fps);
  const written: string[] = [];

  const serveUrl = path.join(RENDER_DIR, "out", "bundle");
  const configPath = path.join(outDir, `${taskId}.still.json`);
  const inputProps: Record<string, unknown> = {
    projectTitle: storyboard.projectTitle,
    pages,
    fps,
    subtitles: false,
    bgm: null,
    theme: opts?.theme || "tech",
    width: opts?.width || 1920,
    height: opts?.height || 1080,
  };
  const video = path.join(outDir, `${taskId}.mp4`);
  const canFfmpeg = existsSync(video);

  try {
    for (let i = 0; i < storyboard.pages.length; i++) {
      const frame = captures[i];
      const outPng = path.join(framesDir, `p${i}.png`);
      try {
        if (canFfmpeg && await ffmpegExtract(video, frame, fps || 30, outPng)) {
          written.push(outPng);
        } else {
          await renderStill(RENDER_DIR, configPath, serveUrl, inputProps, frame, outPng);
          written.push(outPng);
        }
      } catch (e) {
        console.warn(`[frame] 第 ${i} 页预览帧渲染失败，跳过:`, e);
      }
      onProgress?.(0.98 + ((i + 1) / storyboard.pages.length) * 0.02);
    }
  } finally {
    try { rmSync(configPath, { force: true }); } catch {}
  }
  return written;
}

function ffmpegExtract(video: string, frame: number, fps: number, outPng: string): Promise<boolean> {
  const sec = Math.max(0, frame / fps);
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-y", "-ss", sec.toFixed(3), "-i", video, "-frames:v", "1", outPng], {
      stdio: ["ignore", "ignore", "pipe"],
      shell: process.platform === "win32",
    });
    let err = "";
    child.stderr?.on("data", (c: Buffer) => { err += c.toString(); });
    child.on("error", () => resolve(false));
    child.on("close", (code) => {
      if (code === 0 && existsSync(outPng)) resolve(true);
      else {
        console.warn("[frame] ffmpeg 抽帧失败，回退 remotion still:", err.slice(-200));
        resolve(false);
      }
    });
  });
}

function renderStill(
  renderDir: string,
  configPath: string,
  serveUrl: string,
  inputProps: Record<string, unknown>,
  frame: number,
  outPng: string
): Promise<void> {
  writeFileSync(
    configPath,
    JSON.stringify({
      mode: "still",
      serveUrl,
      compositionId: "DynamicVideo",
      output: outPng,
      inputProps,
      frame,
      options: { gl: process.env.RENDER_GL || "swiftshader" },
    }),
  );
  return new Promise((resolve, reject) => {
    const child = spawnRunner([configPath], { cwd: renderDir });
    let err = "";
    child.stderr?.on("data", (c: Buffer) => { err += c.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`remotion still 退出码 ${code} (frame ${frame}): ${err.slice(-400)}`));
    });
  });
}
