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

export const resolveAnchor = (timing: SceneTiming, anchor: number | undefined, fi: number, bd = 0, st = 20): number => {
  if (anchor !== undefined && anchor < timing.captions.length) return timing.captions[anchor].startFrame;
  if (anchor !== undefined && timing.captions.length) return timing.captions[timing.captions.length - 1].startFrame;
  return timing.frameAt(fi, bd, st);
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