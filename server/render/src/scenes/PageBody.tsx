import { AbsoluteFill, Sequence } from "remotion";
import { IconView } from "../shared/render/Icon";
import { CaptionSentence, AudioSentence } from "../components/Caption";
import type { PageBodyProps } from "../shared/render/scenes/types";

export const PageBody: React.FC<PageBodyProps> = ({ page, fps, subtitles, isFirst, Scene }) => {
  const pageFrames = page.sentences && page.sentences.length
    ? page.sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * fps)), 0)
    : Math.round((page.durationSec || 4) * fps);

  return (
    <AbsoluteFill>
      {!isFirst && page.icon ? <IconView icon={page.icon} /> : null}
      <Scene page={page} fps={fps} subtitles={subtitles} isFirst={isFirst} />

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
            off += dur;
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