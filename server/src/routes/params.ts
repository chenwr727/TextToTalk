import type { VideoParams } from "../types.js";

const validSize = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 360 && v <= 4096 ? Math.round(v) : fallback;

export function normalizeParams(p?: Partial<VideoParams>): VideoParams {
  return {
    width: validSize(p?.width, 1920),
    height: validSize(p?.height, 1080),
    fps: p?.fps ?? 30,
    tone: p?.tone ?? "casual",
    narration: p?.narration ?? true,
    subtitles: p?.subtitles ?? true,
    bgm: p?.bgm ?? "default",
    granularity: p?.granularity ?? "medium",
    targetDurationSec: p?.targetDurationSec,
    theme: p?.theme,
    audience: p?.audience,
    coreMessage: p?.coreMessage,
    audienceOutcome: p?.audienceOutcome,
    voice: p?.voice,
    engine: p?.engine,
    ttsSpeed: p?.ttsSpeed,
    ttsVolume: p?.ttsVolume,
  };
}