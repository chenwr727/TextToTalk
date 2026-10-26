import { AbsoluteFill, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { none } from "@remotion/transitions/none";
import type { RenderProps, TransitionType } from "./shared/render/props";
import { TRANSITION_FRAME_MAP, transitionFramesOf } from "../../../shared/types";
import { zoomPush } from "./shared/render/presentations";
import { C, FONT } from "./shared/render/theme";
import { Bg } from "./shared/render/Bg";
import { Spectrum } from "./shared/render/Spectrum";
import { BgmLayer } from "./components/Caption";
import { PageBody } from "./scenes/PageBody";
import { matchScene } from "./shared/render/scenes/sceneRegistry";

/** 默认转场帧数（fade），保留导出是因为 Root 计算总帧数要用同一套口径 */
export const TRANSITION_FRAMES = TRANSITION_FRAME_MAP.fade;

/** 不同转场占用的帧数，来自 shared/types 的唯一定义（服务端抽帧也用同一份） */
export const transitionFrames = (t: TransitionType | undefined): number => transitionFramesOf(t);

function pickTransition(t: TransitionType | undefined): any {
  switch (t) {
    case "slide-left":
      return slide({ direction: "from-left" });
    case "slide-right":
      return slide({ direction: "from-right" });
    case "zoom":
      return zoomPush();
    case "none":
      return none();
    case "fade":
    default:
      return fade();
  }
}

export const DynamicVideo: React.FC<RenderProps> = ({ projectTitle, pages, fps, subtitles, bgm, theme }) => {
  const { durationInFrames } = useVideoConfig();
  const pageDurs = pages.map((p) =>
    p.sentences && p.sentences.length
      ? p.sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * (fps || 30))), 0) +
        Math.round((p.sentenceGap || 0) * (fps || 30)) * Math.max(0, p.sentences.length - 1)
      : Math.round((p.durationSec || 4) * (fps || 30)),
  );

  const children: React.ReactNode[] = [];
  pages.forEach((p, i) => {
    const dur = pageDurs[i];
    const { render: Scene, bg } = matchScene(p, i === 0);
    const isLast = i === pages.length - 1;
    children.push(
      <TransitionSeries.Sequence key={p.pageIndex} durationInFrames={dur}>
        <Bg variant={bg} theme={theme as any} draw={!!p.effects?.pathDraw} />
        <PageBody page={p} fps={fps} subtitles={subtitles} isFirst={i === 0} Scene={Scene} />
      </TransitionSeries.Sequence>,
    );
    if (!isLast) {
      const next = pages[i + 1];
      children.push(
        <TransitionSeries.Transition
          key={`t-${i}`}
          presentation={pickTransition(next?.transition)}
          timing={linearTiming({ durationInFrames: transitionFrames(next?.transition) })}
        />,
      );
    }
  });

  return (
    <AbsoluteFill>
      <TransitionSeries>{children}</TransitionSeries>
      {bgm && <Spectrum src={bgm.audioUrl} />}
      {bgm && <BgmLayer url={bgm.audioUrl} totalFrames={durationInFrames} />}
      {projectTitle && (
        <div style={{ position: "absolute", bottom: 20, right: 24, color: C.muted, fontSize: 20, fontFamily: FONT }}>
          {projectTitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
