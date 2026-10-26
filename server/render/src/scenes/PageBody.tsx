import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { IconView } from "../shared/render/Icon";
import { CaptionSentence, AudioSentence } from "../components/Caption";
import { SceneTimingContext, type SceneTiming, type CaptionTiming } from "../shared/render/captionTiming";
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
 * 构造「序号 -> 入场帧」映射。当元素数多于字幕句数时，超出部分从最后一句字幕
 * 起按 stagger 依次错开，避免所有元素在同一帧同时弹出（画面看起来是一次性糊上来）。
 */
const buildFrameAt =
  (captions: CaptionTiming[], fallbackStagger: number) =>
  (index: number, baseDelay = 0, stagger = fallbackStagger): number => {
    const n = captions.length;
    if (!n) return baseDelay + index * stagger;
    if (index < n) return captions[index].startFrame;
    return captions[n - 1].startFrame + (index - n + 1) * stagger;
  };

export const PageBody: React.FC<PageBodyProps> = ({ page, fps, subtitles, isFirst, Scene }) => {
  const f = useCurrentFrame();
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
    timing = { captions, pageFrames, stagger, frameAt: buildFrameAt(captions, stagger) };
  } else if (page.captions.length) {
    const step = Math.round(pageFrames / page.captions.length);
    const captions: CaptionTiming[] = page.captions.map((c, i) => ({
      startFrame: i * step,
      endFrame: (i + 1) * step,
      text: c,
    }));
    timing = { captions, pageFrames, stagger, frameAt: buildFrameAt(captions, stagger) };
  } else {
    timing = {
      captions: [],
      pageFrames,
      stagger,
      frameAt: (index, baseDelay = 0, st = stagger) => baseDelay + index * st,
    };
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

  // rhythm="anchor"：整页极缓推近，让重点页在停留时保持"还在动"的呼吸感
  const rhythmScale =
    rhythm === "anchor"
      ? interpolate(f, [0, Math.max(1, pageFrames)], [1, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  return (
    <AbsoluteFill style={accentVars(page.accent)}>
      {!isFirst && page.icon ? <IconView icon={page.icon} /> : null}
      <div style={{ position: "absolute", inset: 0, perspective: 1600 }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", ...flip }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${rhythmScale})` }}>
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
