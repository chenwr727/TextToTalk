import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Storyboard } from "../types.js";
import { assetsDir, mediaUrl } from "./runtime.js";
import { wavDurationSeconds } from "./deps.js";

export interface TtsSentence {
  text: string;
  seconds: number;
  audioUrl: string;
}
export interface TtsPage {
  index: number;
  sentences: TtsSentence[];
  totalSeconds: number;
}
export interface TtsResult {
  fps: number;
  sentenceGap: number;
  pages: TtsPage[];
  failedCount: number;
}

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";
const SENTENCE_GAP = 0.5;
const FPS = 30;
const CONCURRENCY = 3;
const TTS_RETRIES = 3;
const TTS_RETRY_DELAY_MS = 1500;

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString());
    });
  });
}

async function synthToFileOnce(text: string, mp3Path: string, voice: string): Promise<void> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = (tts as unknown as { toStream: (t: string) => { audioStream: import("stream").Readable } }).toStream(text);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    writeFileSync(mp3Path, Buffer.concat(chunks));
  } finally {
    try {
      if (typeof (tts as unknown as { close?: () => void }).close === "function")
        (tts as unknown as { close: () => void }).close();
    } catch { /* ignore */ }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthToFile(text: string, mp3Path: string, voice: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= TTS_RETRIES; attempt++) {
    try {
      await synthToFileOnce(text, mp3Path, voice);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < TTS_RETRIES) {
        const delay = TTS_RETRY_DELAY_MS * (attempt + 1);
        console.warn(`[tts] 句重试 ${attempt + 1}/${TTS_RETRIES}（${delay}ms 后）: ${text}`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

async function mp3toWav(mp3: string, wav: string): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-ar", "44100", "-ac", "2", wav]);
}

async function measureSeconds(wav: string): Promise<number> {
  const parsed = wavDurationSeconds(wav);
  if (parsed !== null && Number.isFinite(parsed) && parsed > 0) return parsed;
  try {
    const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", wav]);
    const d = parseFloat(JSON.parse(out).format.duration);
    return Number.isFinite(d) && d > 0 ? d : 2;
  } catch { return 2; }
}

export async function generateTts(taskId: string, storyboard: Storyboard, voice?: string): Promise<TtsResult> {
  const audioDir = path.join(assetsDir, "tts", taskId, "audio");
  mkdirSync(audioDir, { recursive: true });
  const v = voice || DEFAULT_VOICE;

  const items: { pi: number; si: number; text: string; mp3: string; wav: string }[] = [];
  for (const p of storyboard.pages) {
    for (let si = 0; si < p.captions.length; si++) {
      const stem = `${taskId}_${p.pageIndex}_${si}`;
      items.push({
        pi: p.pageIndex, si, text: p.captions[si],
        mp3: path.join(audioDir, `._${stem}.mp3`),
        wav: path.join(audioDir, `${stem}.wav`),
      });
    }
  }

  let cursor = 0;
  let failed = 0;
  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) break;
      const it = items[idx];
      try {
        await synthToFile(it.text, it.mp3, v);
        await mp3toWav(it.mp3, it.wav);
        try { rmSync(it.mp3); } catch { /* ignore */ }
      } catch (e) {
        failed++;
        console.error("[tts] 句失败:", it.text, e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));

  if (failed === items.length && items.length > 0) {
    throw new Error(`TTS 全部 ${items.length} 句合成失败，无法渲染配音`);
  } else if (failed > 0) {
    console.warn(`[tts] 有 ${failed}/${items.length} 句 TTS 合成失败，成片将缺少对应旁白`);
  }

  const pages: TtsPage[] = [];
  for (const it of items.sort((a, b) => (a.pi - b.pi) || (a.si - b.si))) {
    if (!existsSync(it.wav)) continue;
    const seconds = await measureSeconds(it.wav);
    let page = pages.find((pp) => pp.index === it.pi);
    if (!page) {
      page = { index: it.pi, sentences: [], totalSeconds: 0 };
      pages.push(page);
    }
    page.sentences.push({
      text: it.text,
      seconds,
      audioUrl: mediaUrl(`tts/${taskId}/audio/${path.basename(it.wav)}`),
    });
  }
  for (const page of pages) {
    page.totalSeconds = Math.round(page.sentences.reduce((a, s) => a + s.seconds, 0) + SENTENCE_GAP * Math.max(0, page.sentences.length - 1));
  }

  return { fps: FPS, sentenceGap: SENTENCE_GAP, pages, failedCount: failed };
}