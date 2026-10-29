import { createContext, useContext } from "react";

export interface CaptionTiming {
  startFrame: number;
  endFrame: number;
  text: string;
}

export interface SceneTiming {
  captions: CaptionTiming[];
  pageFrames: number;
  /** 本页 rhythm 决定的元素错开帧数，由 PageBody 注入，场景无需各自关心 */
  stagger: number;
  frameAt: (index: number, baseDelay?: number, stagger?: number) => number;
}

export const SceneTimingContext = createContext<SceneTiming | null>(null);

/**
 * 元素入场的"最后期限"：页内多少比例之前必须全部到场。
 *
 * 这条线存在的理由（实测）：元素原来一律跟字幕绑入场，而一句字幕占掉一整页的一半是
 * 常态。9 秒的环形页两句字幕 -> 第三个节点在页内约 58% 才出现；折叠流程页三张卡里
 * 第三张同理。于是**成片前半程是缺斤少两的**：环形图只有 1/3 个节点、旁边一片空白，
 * 观众读到的是"内容缺失/渲染坏了"，而不是"还没长出来"。
 *
 * 更糟的是看不出来：`previewCaptureFrames` 取页内 75% 出预览图，预览永远是完整的。
 *
 * 所以规则改成：**只有模型显式给了 anchor 的元素才跟字幕严格对齐**，其余元素走
 * 页首节奏（第 i 个在 baseDelay + i*stagger 帧入场），并由这条线封顶。
 */
export const REVEAL_DEADLINE = 0.45;

/**
 * 把「元素序号 / 字幕序号」映射为入场帧。
 *
 * 核心规则：
 * 1. 有 anchor 且在字幕范围内 -> 用该句字幕的起始帧（画面与解说对齐，这是 anchor 的用途）。
 * 2. 有 anchor 但超出字幕条数 -> 退回页首节奏（按 index * stagger 错开）。
 * 3. 没 anchor -> 页首节奏，且封顶在页内 REVEAL_DEADLINE 之前（见上）。
 */
export const resolveAnchor = (
  timing: SceneTiming,
  anchor: number | undefined,
  fi: number,
  bd = 0,
  st = timing.stagger ?? 20,
): number => {
  const n = timing.captions.length;
  if (!n) return timing.frameAt(fi, bd, st);
  if (anchor !== undefined && anchor < n) return timing.captions[anchor].startFrame;
  return timing.frameAt(fi, bd, st);
};

export const useSceneTiming = (): SceneTiming => {
  const ctx = useContext(SceneTimingContext);
  if (!ctx) {
    return {
      captions: [],
      pageFrames: 0,
      stagger: 20,
      frameAt: (index, baseDelay = 0, stagger = 20) => baseDelay + index * stagger,
    };
  }
  return ctx;
};
