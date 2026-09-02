import type { FC } from "react";
import { Composition } from "remotion";
import { DynamicVideo, TRANSITION_FRAMES } from "./DynamicVideo";
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
  const transitionFrames = Math.max(0, (pages || []).length - 1) * TRANSITION_FRAMES;
  return Math.max(30, frames - transitionFrames);
}

export const RemotionRoot: FC = () => (
  <Composition<any, RenderProps>
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
