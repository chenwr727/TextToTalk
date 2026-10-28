import type { FC } from "react";
import { Composition } from "remotion";
import { DynamicVideo, transitionFrames } from "./DynamicVideo";
import type { RenderProps } from "./shared/render/props";

const DEFAULT_FPS = 30;

export const defaultProps: RenderProps = {
  projectTitle: "",
  pages: [],
  fps: DEFAULT_FPS,
  subtitles: true,
  bgm: null,
  theme: "tech",
  width: 1920,
  height: 1080,
};

export function computeTotalFrames(pages: RenderProps["pages"], fps: number): number {
  const f = fps || DEFAULT_FPS;
  const frames = (pages || []).reduce((sum: number, p) => {
    if (p && p.sentences && p.sentences.length) {
      const gapFrames = Math.round((p.sentenceGap || 0) * f);
      return (
        sum +
        p.sentences.reduce((acc, x) => acc + Math.max(1, Math.round(x.seconds * f)), 0) +
        gapFrames * Math.max(0, p.sentences.length - 1)
      );
    }
    return sum + Math.round((p.durationSec || 4) * f);
  }, 1);
  // 转场占用帧随类型不同（none=1 / zoom=16 / slide=14 / fade=12），必须逐页按同一口径累加
  const transitionFramesTotal = (pages || []).reduce(
    (sum: number, p: RenderProps["pages"][number], i: number) =>
      i === 0 ? sum : sum + transitionFrames(p?.transition),
    0,
  );
  return Math.max(30, frames - transitionFramesTotal);
}

/*
 * 第一个类型参数在 Remotion 4 里是"可选的 zod schema"（AnyZodObject），不是 props 类型——
 * 项目不用 schema（props 由 Node 侧直接传），所以只能给一个"满足约束但永不使用"的占位类型。
 * 第二个类型参数才是真正生效的 props（RenderProps）。
 */
type NoSchema = { _def: unknown; _input: unknown };

export const RemotionRoot: FC = () => (
  <Composition<NoSchema, RenderProps>
    id="DynamicVideo"
    component={DynamicVideo}
    durationInFrames={30}
    fps={DEFAULT_FPS}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => {
      const fps = props.fps || DEFAULT_FPS;
      return {
        durationInFrames: computeTotalFrames(props.pages, fps),
        fps,
        width: props.width || 1920,
        height: props.height || 1080,
      };
    }}
  />
);
