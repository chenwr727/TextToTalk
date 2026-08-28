import { Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { TtsSentence } from "../shared/render/props";
import { C, FONT } from "../shared/render/theme";

const Aud = Audio as any;

const HIGHLIGHT = "#ffd54a";

const renderHighlight = (text: string) => {
  const re = /[-+]?\d+(?:\.\d+)?\s*[%％倍xX]?|(?:[一二三四五六七八九十百千万]+倍)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={k++} style={{ color: HIGHLIGHT, fontWeight: 800 }}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

export const CaptionSentence: React.FC<{ text: string; durFrames: number }> = ({ text, durFrames }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, durFrames - 8, durFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 60, width: "100%", display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ display: "flex", alignItems: "stretch", maxWidth: "78%" }}>
        <div style={{ width: 10, background: C.accent, borderRadius: "999px 0 0 999px" }} />
        <div style={{
          background: "rgba(20,30,45,0.88)", color: "#fff", padding: "16px 42px", fontSize: 42, fontFamily: FONT, fontWeight: 600,
          textAlign: "center", borderRadius: "0 999px 999px 0", boxShadow: "0 8px 24px rgba(20,30,45,0.4)", letterSpacing: 1,
          textShadow: "0 2px 6px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.6)",
        }}>
          {renderHighlight(text)}
        </div>
      </div>
    </div>
  );
};

export const AudioSentence: React.FC<{ sentence: TtsSentence; fps: number; subtitles: boolean }> = ({ sentence, fps, subtitles }) => {
  const dur = Math.max(1, Math.round(sentence.seconds * fps));
  return (
    <Sequence durationInFrames={dur}>
      {sentence.audioUrl ? <Aud src={sentence.audioUrl} /> : null}
      {subtitles && <CaptionSentence text={sentence.text} durFrames={dur} />}
    </Sequence>
  );
};

export const BgmLayer: React.FC<{ url: string; totalFrames: number }> = ({ url, totalFrames }) => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [totalFrames - 40, Math.max(totalFrames - 8, totalFrames - 40 + 1)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <Aud src={url} volume={fadeOut} />;
};