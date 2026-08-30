import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assetsDir, mediaUrl } from "./runtime.js";

export interface BgmResult {
  audioUrl: string;
  seconds: number;
}

const SR = 44100;
const MASTER = 0.25;
const ARP = [261.63, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 261.63];
const NOTESEC = 0.33;
const CHUNK_SAMPLES = Math.floor(SR * 0.5);

async function synthBgmWav(durationSec: number): Promise<Buffer> {
  const n = Math.floor(SR * durationSec);
  const samples = new Float64Array(n);
  let peak = 0;
  const fill = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      const t = i / SR;
      const k = Math.floor(t / NOTESEC) % ARP.length;
      const local = t - Math.floor(t / NOTESEC) * NOTESEC;
      const env = Math.exp(-local * 7.0);
      const arp = Math.sin(2 * Math.PI * ARP[k] * t) * env;
      const bassF = Math.floor(t / 2) % 2 === 0 ? 130.81 : 98.0;
      const bass = Math.sin(2 * Math.PI * bassF * t) * 0.3;
      const v = arp * 0.85 + bass * 0.15;
      samples[i] = v;
      if (v > peak) peak = v; else if (-v > peak) peak = -v;
    }
  };
  for (let start = 0; start < n; start += CHUNK_SAMPLES) {
    fill(start, Math.min(n, start + CHUNK_SAMPLES));
    await new Promise((r) => setImmediate(r));
  }
  const scale = (peak || 1.0) === 0 ? 1.0 : 0.35 / peak;

  const bytesPerSample = 2;
  const numChannels = 2;
  const dataSize = n * numChannels * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * numChannels * bytesPerSample, 28);
  buf.writeUInt16LE(numChannels * bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let start = 0; start < n; start += CHUNK_SAMPLES) {
    let o = 44 + start * numChannels * bytesPerSample;
    const end = Math.min(n, start + CHUNK_SAMPLES);
    for (let i = start; i < end; i++) {
      let v = samples[i] * scale * MASTER;
      v = Math.max(-1, Math.min(1, v));
      const s = Math.round(v * 32767);
      buf.writeInt16LE(s, o); o += 2;
      buf.writeInt16LE(s, o); o += 2;
    }
    if (end < n) await new Promise((r) => setImmediate(r));
  }
  return buf;
}

export async function generateBgm(taskId: string, durationSec: number): Promise<BgmResult | null> {
  try {
    const dir = path.join(assetsDir, "bgm");
    mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${taskId}.wav`);
    writeFileSync(out, await synthBgmWav(Math.max(3, durationSec)));
    return { audioUrl: mediaUrl(`bgm/${taskId}.wav`), seconds: durationSec };
  } catch (e) {
    console.error("[bgm] 生成失败（忽略，继续渲染）", e);
    return null;
  }
}