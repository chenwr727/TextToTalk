import { createContext, useContext } from "react";

export interface CaptionTiming {
  startFrame: number;
  endFrame: number;
  text: string;
}

export interface SceneTiming {
  captions: CaptionTiming[];
  pageFrames: number;
  frameAt: (index: number, baseDelay?: number, stagger?: number) => number;
}

export const SceneTimingContext = createContext<SceneTiming | null>(null);

/**
 * 把「元素序号 / 字幕序号」映射为入场帧。
 *
 * 核心规则：
 * 1. 有 anchor 且在字幕范围内 -> 用该句字幕的起始帧（画面与解说对齐）。
 * 2. 有 anchor 但超出字幕条数 -> 不再全部堆到最后一帧，而是从最后一句字幕起，
 *    按 index * stagger 向后依次错开（避免多个元素同时弹出）。
 * 3. 没 anchor 时：用第 fi 个字幕的起始帧；若 fi 超出字幕，则在最后一句字幕
 *    基础上按 stagger 递延，保证依然有先后节奏而不是挤在同一帧。
 */
export const resolveAnchor = (timing: SceneTiming, anchor: number | undefined, fi: number, bd = 0, st = 20): number => {
  const n = timing.captions.length;
  if (!n) return timing.frameAt(fi, bd, st);
  if (anchor !== undefined) {
    if (anchor < n) return timing.captions[anchor].startFrame;
    const last = timing.captions[n - 1].startFrame;
    return last + (anchor - n + 1) * st;
  }
  if (fi < n) return timing.captions[fi].startFrame;
  const last = timing.captions[n - 1].startFrame;
  return last + (fi - n + 1) * st;
};

export const useSceneTiming = (): SceneTiming => {
  const ctx = useContext(SceneTimingContext);
  if (!ctx) {
    return {
      captions: [],
      pageFrames: 0,
      frameAt: (index, baseDelay = 0, stagger = 20) => baseDelay + index * stagger,
    };
  }
  return ctx;
};
