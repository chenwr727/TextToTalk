import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsSynthOptions } from "./types.js";

const SEED_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

const SEED_TTS_API_KEY = process.env.SEED_TTS_API_KEY;
const SEED_TTS_RESOURCE_ID = process.env.SEED_TTS_RESOURCE_ID || "seed-tts-2.0";

interface SeedTtsEvent {
  code: number;
  message?: string;
  data?: string;
}

function parseNdjsonStream(onChunk: (buf: Buffer) => void): (line: string) => boolean {
  return (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    let event: SeedTtsEvent;
    try {
      event = JSON.parse(trimmed) as SeedTtsEvent;
    } catch {
      return false;
    }
    if (event.code === 0 || event.code === 3000) {
      if (event.data) onChunk(Buffer.from(event.data, "base64"));
      return false;
    }
    if (event.code === 20000000) return true;
    throw new Error(`Seed-TTS 合成失败 (${event.code}): ${event.message ?? "未知错误"}`);
  };
}

async function synthViaFetch(
  body: string,
  headers: Record<string, string>,
  outPath: string,
): Promise<void> {
  const resp = await fetch(SEED_TTS_ENDPOINT, {
    method: "POST",
    headers,
    body,
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Seed-TTS HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const textStream = resp.body;
  if (!textStream) throw new Error("Seed-TTS: 响应无数据流");

  const chunks: Buffer[] = [];
  const reader = textStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleLine = parseNdjsonStream((buf) => chunks.push(buf));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (handleLine(line)) {
        reader.releaseLock();
        writeFileSync(outPath, Buffer.concat(chunks));
        return;
      }
    }
  }
  writeFileSync(outPath, Buffer.concat(chunks));
}

function synthViaCurl(
  body: string,
  headers: Record<string, string>,
  outPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["-sS", "-N", "-X", "POST", SEED_TTS_ENDPOINT];
    for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
    args.push("--data-binary", body);

    const child = spawn("curl", args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = "";
    let buffer = "";
    const handleLine = parseNdjsonStream((buf) => chunks.push(buf));

    child.stdout.on("data", (d: Buffer) => {
      buffer += d.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (handleLine(line)) {
          child.kill();
          writeFileSync(outPath, Buffer.concat(chunks));
          resolve();
          return;
        }
      }
    });

    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    child.on("error", (err) => reject(new Error(`Seed-TTS curl 启动失败: ${err.message}`)));
    child.on("close", (code) => {
      if (chunks.length) {
        writeFileSync(outPath, Buffer.concat(chunks));
        resolve();
        return;
      }
      reject(new Error(`Seed-TTS curl 失败 (exit ${code}): ${stderr.slice(0, 300)}`));
    });
  });
}

function synthSeedTts(config: TtsEngineConfig) {
  const model = (config.model as string) || "seed-tts-2.0-expressive";
  const sampleRate = (config.sampleRate as number) || 24000;
  const format = (config.format as string) || "mp3";
  const additions = (config.additions as string) || "";

  return async function synth(text: string, outPath: string, voice: string, options?: TtsSynthOptions): Promise<void> {
    if (!SEED_TTS_API_KEY) throw new Error("Seed-TTS: 缺少环境变量 SEED_TTS_API_KEY");

    const speechRate = options?.speed != null && options.speed !== 1
      ? Math.round((options.speed - 1) * 100)
      : 0;

    const reqParams: Record<string, unknown> = {
      text,
      speaker: voice,
      model,
      audio_params: {
        format,
        sample_rate: sampleRate,
        speech_rate: speechRate,
      },
    };
    if (additions) reqParams.additions = additions;

    const body = JSON.stringify({ user: { uid: "texttotalk" }, req_params: reqParams });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": SEED_TTS_API_KEY,
      "X-Api-Resource-Id": SEED_TTS_RESOURCE_ID,
      "X-Api-Request-Id": randomUUID(),
    };

    try {
      await synthViaFetch(body, headers, outPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/fetch failed|ECONNRESET|Access is denied|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
        await synthViaCurl(body, headers, outPath);
      } else {
        throw e;
      }
    }
  };
}

export const seedTtsFactory: TtsEngineFactory = (config: TtsEngineConfig): TtsEngine => ({
  id: config.id,
  name: config.name,
  voices: config.voices ?? [],
  config,
  synthToFile: synthSeedTts(config),
});