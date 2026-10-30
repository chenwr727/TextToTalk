import { AbsoluteFill, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { none } from "@remotion/transitions/none";
import type { RenderProps, TransitionType } from "./shared/render/props";
import { TRANSITION_FRAME_MAP, transitionFramesOf } from "../../../shared/types";
import { zoomPush } from "./shared/render/presentations";
import { C, FONT, ThemeContext, THEME_TOKENS, normalizeThemeId, themeVars } from "./shared/render/theme";
import { Bg } from "./shared/render/Bg";
import { FontLoader } from "./shared/render/fonts";
import { Spectrum } from "./shared/render/Spectrum";
import { BgmLayer } from "./components/Caption";
import { PageBody } from "./scenes/PageBody";
import { matchScene } from "./shared/render/scenes/sceneRegistry";
import { DomProbe } from "./shared/render/DomProbe";

/** 默认转场帧数（fade），保留导出是因为 Root 计算总帧数要用同一套口径 */
export const TRANSITION_FRAMES = TRANSITION_FRAME_MAP.fade;

/** 不同转场占用的帧数，来自 shared/types 的唯一定义（服务端抽帧也用同一份） */
export const transitionFrames = (t: TransitionType | undefined): number => transitionFramesOf(t);

/*
 * 这里的 any 是库的类型限制，不是偷懒：
 * Remotion 的 TransitionPresentation<T> 对 T 不变，五套预设（fade / slide / zoom / none）
 * 各自的 props 类型互不兼容，合不成一个能赋给 TransitionSeries.Transition 的单一类型
 * （不写 any 时 tsc 直接报 TS2322）。真要去掉得给每个分支加 as unknown as，反而更脏。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 见上：Remotion 的转场预设类型不变，无法合并
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

export const DynamicVideo: React.FC<RenderProps> = ({ projectTitle, pages, fps, subtitles, bgm, theme, probe }) => {
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
        <Bg variant={bg} theme={normalizeThemeId(theme)} draw={!!p.effects?.pathDraw} decor={p.decor} />
        <PageBody page={p} fps={fps} subtitles={subtitles} isFirst={i === 0} Scene={Scene} pageIndex={i} />
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
    <ThemeContext.Provider value={THEME_TOKENS[normalizeThemeId(theme)]}>
      <AbsoluteFill style={themeVars(theme)}>
        <FontLoader />
        <TransitionSeries>{children}</TransitionSeries>
        {probe ? <DomProbe spec={probe} /> : null}
        {bgm && <Spectrum src={bgm.audioUrl} />}
        {bgm && <BgmLayer url={bgm.audioUrl} totalFrames={durationInFrames} />}
        {projectTitle && (
          <div style={{ position: "absolute", bottom: 20, right: 24, color: C.muted, fontSize: 20, fontFamily: FONT }}>
            {projectTitle}
          </div>
        )}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
