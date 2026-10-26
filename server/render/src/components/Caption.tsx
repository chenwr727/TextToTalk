import { Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { TtsSentence } from "../shared/render/props";
import { C, FONT, FW } from "../shared/render/theme";
import { useResponsive, CAPTION_METRICS } from "../shared/render/responsive";
import { tokenizeCaption } from "../shared/render/tokenize";

const Aud = Audio as any;

const HIGHLIGHT = "#ffd54a";
const DIM = "rgba(255,255,255,0.42)";

/** 旧的整句数字高亮（karaoke 关闭时仍用） */
const renderHighlight = (text: string) => {
  const re = /[-+]?\d+(?:\.\d+)?\s*[%％倍xX]?|(?:[一二三四五六七八九十百千万]+倍)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={k++} style={{ color: HIGHLIGHT, fontWeight: FW.heavy }}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

/**
 * 字幕。
 *
 * karaoke：按句子时长把 token 依次"点亮"，没读到的字是半透明灰，读到的变白，
 * 其中的数字/百分比变琥珀色加粗。口播视频的专业感基本来自这一层——
 * 整句直接出现（原来的做法）看着就像内嵌的硬字幕文件，而逐词跟读像真人剪辑。
 */
export const CaptionSentence: React.FC<{ text: string; durFrames: number; karaoke?: boolean }> = ({
  text,
  durFrames,
  karaoke = true,
}) => {
  const f = useCurrentFrame();
  const { isPortrait, fs, sp } = useResponsive();
  const fade = Math.max(1, Math.min(8, Math.floor(durFrames / 4)));
  const o = interpolate(
    f,
    [0, fade, Math.max(fade + 1, durFrames - fade), Math.max(fade + 2, durFrames)],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // 语速基本铺满整句：留 6% 起手、8% 收尾，中间线性推进
  const tokens = tokenizeCaption(text);
  const n = Math.max(1, tokens.length);
  const p = interpolate(f, [Math.round(durFrames * 0.06), Math.round(durFrames * 0.92)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: sp(CAPTION_METRICS.bottom),
        width: "100%",
        display: "flex",
        justifyContent: "center",
        opacity: o,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", maxWidth: isPortrait ? "88%" : "78%" }}>
        <div style={{ width: 10, background: C.accent, borderRadius: "999px 0 0 999px" }} />
        <div
          style={{
            background: "rgba(20,30,45,0.88)",
            color: "#fff",
            padding: `${sp(CAPTION_METRICS.padY)}px ${sp(42)}px`,
            fontSize: fs(CAPTION_METRICS.fontSize),
            fontFamily: FONT,
            fontWeight: FW.regular,
            textAlign: "center",
            borderRadius: "0 999px 999px 0",
            boxShadow: "0 8px 24px rgba(20,30,45,0.4)",
            letterSpacing: 1,
            textShadow: "0 2px 6px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.6)",
          }}
        >
          {karaoke
            ? tokens.map((tk, i) => {
                const t0 = i / n;
                const lit = interpolate(p, [t0, Math.min(1, t0 + 0.12)], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const on = lit > 0.5;
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline",
                      color: on ? (tk.num ? HIGHLIGHT : "#fff") : DIM,
                      fontWeight: on && tk.num ? FW.heavy : FW.regular,
                      transition: "none",
                    }}
                  >
                    {tk.text}
                  </span>
                );
              })
            : renderHighlight(text)}
        </div>
      </div>
    </div>
  );
};

export const AudioSentence: React.FC<{ sentence: TtsSentence; fps: number; subtitles: boolean }> = ({
  sentence,
  fps,
  subtitles,
}) => {
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
