import type { VideoParams } from "../types.js";

export function normalizeParams(p?: Partial<VideoParams>): VideoParams {
  return {
    width: p?.width ?? 1920,
    height: p?.height ?? 1080,
    fps: p?.fps ?? 30,
    tone: p?.tone ?? "casual",
    narration: p?.narration ?? true,
    subtitles: p?.subtitles ?? true,
    bgm: p?.bgm ?? "default",
    granularity: p?.granularity ?? "medium",
    targetDurationSec: p?.targetDurationSec,
  };
}