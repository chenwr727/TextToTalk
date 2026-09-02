import { writeFileSync } from "node:fs";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsSynthOptions } from "./types.js";

function prosodyOptions(options?: TtsSynthOptions): { rate?: number; volume?: number } {
  const opts: { rate?: number; volume?: number } = {};
  if (options?.speed != null && options.speed !== 1) opts.rate = options.speed;
  if (options?.volume != null && options.volume !== 1) opts.volume = Math.round(options.volume * 50);
  return opts;
}

async function synthEdge(text: string, outPath: string, voice: string, options?: TtsSynthOptions): Promise<void> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, prosodyOptions(options));
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    writeFileSync(outPath, Buffer.concat(chunks));
  } finally {
    try {
      tts.close();
    } catch { /* ignore */ }
  }
}

export const edgeFactory: TtsEngineFactory = (config: TtsEngineConfig): TtsEngine => ({
  id: config.id,
  name: config.name,
  voices: config.voices ?? [],
  config,
  synthToFile: synthEdge,
});