import { AbsoluteFill, Sequence } from "remotion";
import { IconView } from "../shared/render/Icon";
import { CaptionSentence, AudioSentence } from "../components/Caption";
import { SceneTimingContext, type SceneTiming, type CaptionTiming } from "../shared/render/captionTiming";
import type { PageBodyProps } from "../shared/render/scenes/types";

export const PageBody: React.FC<PageBodyProps> = ({ page, fps, subtitles, isFirst, Scene }) => {
  const gapFrames = Math.round((page.sentenceGap || 0) * fps);
  const pageFrames = page.sentences && page.sentences.length
    ? page.sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * fps)), 0) + gapFrames * Math.max(0, page.sentences.length - 1)
    : Math.round((page.durationSec || 4) * fps);

  let timing: SceneTiming;
  if (page.sentences && page.sentences.length) {
    const captions: CaptionTiming[] = [];
    let off = 0;
    for (const s of page.sentences) {
      const dur = Math.max(1, Math.round(s.seconds * fps));
      captions.push({ startFrame: off, endFrame: off + dur, text: s.text });
      off += dur + gapFrames;
    }
    timing = {
      captions,
      pageFrames,
      frameAt: (index, baseDelay = 0, stagger = 20) => {
        if (index < captions.length) return captions[index].startFrame;
        if (captions.length) return captions[captions.length - 1].startFrame;
        return baseDelay + index * stagger;
      },
    };
  } else if (page.captions.length) {
    const step = Math.round(pageFrames / page.captions.length);
    const captions: CaptionTiming[] = page.captions.map((c, i) => ({
      startFrame: i * step,
      endFrame: (i + 1) * step,
      text: c,
    }));
    timing = {
      captions,
      pageFrames,
      frameAt: (index, baseDelay = 0, stagger = 20) => {
        if (index < captions.length) return captions[index].startFrame;
        if (captions.length) return captions[captions.length - 1].startFrame;
        return baseDelay + index * stagger;
      },
    };
  } else {
    timing = {
      captions: [],
      pageFrames,
      frameAt: (index, baseDelay = 0, stagger = 20) => baseDelay + index * stagger,
    };
  }

  return (
    <AbsoluteFill>
      {!isFirst && page.icon ? <IconView icon={page.icon} /> : null}
      <SceneTimingContext.Provider value={timing}>
        <Scene page={page} fps={fps} subtitles={subtitles} isFirst={isFirst} />
      </SceneTimingContext.Provider>

      {page.sentences && page.sentences.length ? (
        (() => {
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
      ) : (
        (() => {
          if (!page.captions.length) return null;
          const step = Math.round(pageFrames / page.captions.length);
          const el = page.captions.map((c, i) => (
            <Sequence key={i} from={i * step} durationInFrames={step}>
              <CaptionSentence text={c} durFrames={step} />
            </Sequence>
          ));
          return el;
        })()
      )}
    </AbsoluteFill>
  );
};