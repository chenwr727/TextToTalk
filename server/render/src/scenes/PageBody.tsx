import { useRef } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { BodyProbe } from "../shared/render/BodyProbe";
import { IconView } from "../shared/render/Icon";
import { CaptionSentence, AudioSentence } from "../components/Caption";
import {
  REVEAL_DEADLINE,
  SceneTimingContext,
  type SceneTiming,
  type CaptionTiming,
} from "../shared/render/captionTiming";
import { accentVars } from "../shared/render/theme";
import { AnnotationContext } from "../shared/render/annotation";
import type { PageBodyProps } from "../shared/render/scenes/types";

/**
 * rhythm -> 元素之间的错开帧数。
 * dense 更急促（信息密集页要跟得上解说），breathing 更舒缓（给观众喘息），anchor 略慢以突出重点。
 */
const RHYTHM_STAGGER: Record<string, number> = { dense: 12, anchor: 24, breathing: 34 };
const DEFAULT_STAGGER = 20;

/**
 * 构造「序号 -> 入场帧」映射。
 *
 * 历史上这里把序号映射到第 i 句字幕的起始帧，好处是画面对齐解说，代价是**页面在前半程
 * 是残缺的**（一句字幕常占掉半页，第三个元素就到页内 58% 才出场）。现在改成页首节奏 +
 * 封顶：`baseDelay + index * stagger`，并且不晚于页内 `REVEAL_DEADLINE`。真正需要"跟这句
 * 解说一起出现"的元素由模型/AI 给 `anchor` 显式指定，走 resolveAnchor 的字幕分支。
 */
const buildFrameAt =
  (fallbackStagger: number, pageFrames: number) =>
  (index: number, baseDelay = 0, stagger = fallbackStagger): number => {
    const start = baseDelay + index * stagger;
    if (!pageFrames) return start;
    return Math.min(start, Math.round(pageFrames * REVEAL_DEADLINE));
  };

export const PageBody: React.FC<PageBodyProps> = ({ page, fps, subtitles, isFirst, Scene, pageIndex }) => {
  const f = useCurrentFrame();
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const gapFrames = Math.round((page.sentenceGap || 0) * fps);
  const pageFrames =
    page.sentences && page.sentences.length
      ? page.sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * fps)), 0) +
        gapFrames * Math.max(0, page.sentences.length - 1)
      : Math.round((page.durationSec || 4) * fps);

  const rhythm = page.rhythm ?? "dense";
  const stagger = RHYTHM_STAGGER[rhythm] ?? DEFAULT_STAGGER;

  let timing: SceneTiming;
  if (page.sentences && page.sentences.length) {
    const captions: CaptionTiming[] = [];
    let off = 0;
    for (const s of page.sentences) {
      const dur = Math.max(1, Math.round(s.seconds * fps));
      captions.push({ startFrame: off, endFrame: off + dur, text: s.text });
      off += dur + gapFrames;
    }
    timing = { captions, pageFrames, stagger, frameAt: buildFrameAt(stagger, pageFrames) };
  } else if (page.captions.length) {
    const step = Math.round(pageFrames / page.captions.length);
    const captions: CaptionTiming[] = page.captions.map((c, i) => ({
      startFrame: i * step,
      endFrame: (i + 1) * step,
      text: c,
    }));
    timing = { captions, pageFrames, stagger, frameAt: buildFrameAt(stagger, pageFrames) };
  } else {
    timing = { captions: [], pageFrames, stagger, frameAt: buildFrameAt(stagger, pageFrames) };
  }

  // effects.threeD：整页 3D 翻转入场（rotateY + 轻微推远），交给父层 perspective 才有效的
  const threeD = !!page.effects?.threeD;
  const enter = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flip: React.CSSProperties = threeD
    ? {
        transform: `rotateY(${(1 - enter) * -18}deg) translateZ(${(1 - enter) * -60}px)`,
        opacity: interpolate(f, [0, 9], [0.15, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }
    : {};

  // 曾经这里给 rhythm="anchor" 的页面加了"整页从 1 缓推到 1.03"的呼吸感。
  // 已移除：anchor 是默认节奏，等于让全片每一页的文字都在逐帧重新光栅化——
  // 每帧只挪 0.1px，看着不像运动，只像文字在轻微晃动（从成片里抽帧做差分可以量出来）。
  // 文字要"稳"，呼吸感交给背景层与转场去做。

  return (
    <AbsoluteFill style={accentVars(page.accent)}>
      {!isFirst && page.icon ? <IconView icon={page.icon} /> : null}
      <div style={{ position: "absolute", inset: 0, perspective: 1600 }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", ...flip }}>
          <div ref={sceneRef} style={{ position: "absolute", inset: 0 }}>
            <BodyProbe pageIndex={pageIndex} sceneRef={sceneRef} />
            <SceneTimingContext.Provider value={timing}>
              <AnnotationContext.Provider value={page.effects?.annotation}>
                <Scene page={page} fps={fps} subtitles={subtitles} isFirst={isFirst} />
              </AnnotationContext.Provider>
            </SceneTimingContext.Provider>
          </div>
        </div>
      </div>

      {page.sentences && page.sentences.length
        ? (() => {
            let off = 0;
            return page.sentences.map((s, i) => {
              const dur = Math.max(1, Math.round(s.seconds * fps));
              const el = (
                <Sequence key={i} from={off}>
                  <AudioSentence sentence={s} fps={fps} subtitles={subtitles} />
                </Sequence>
              );
              off += dur + gapFrames;
              return el;
            });
          })()
        : (() => {
            if (!page.captions.length) return null;
            const step = Math.round(pageFrames / page.captions.length);
            const el = page.captions.map((c, i) => (
              <Sequence key={i} from={i * step} durationInFrames={step}>
                <CaptionSentence text={c} durFrames={step} />
              </Sequence>
            ));
            return el;
          })()}
    </AbsoluteFill>
  );
};
