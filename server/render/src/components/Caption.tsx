import { Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { TtsSentence } from "../shared/render/props";
import { C, FONT, FW, RADIUS, alpha } from "../shared/render/theme";
import { useResponsive, CAPTION_METRICS } from "../shared/render/responsive";
import { tokenizeCaption } from "../shared/render/tokenize";

const Aud = Audio as any;

const HIGHLIGHT = "#ffd54a";
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
  const { isPortrait, sp } = useResponsive();
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
        <div
          style={{
            // 字幕条：一整条胶囊，左侧强调色改成"内嵌竖条"。
            // 原来是"外挂圆角方块 + 右侧直角"两块拼出来的，接缝处圆角对不上，看着像贴了个把手。
            position: "relative",
            background: "linear-gradient(180deg, rgba(17,25,38,0.90) 0%, rgba(17,25,38,0.82) 100%)",
            color: "#fff",
            padding: `${sp(CAPTION_METRICS.padY)}px ${sp(44)}px`,
            // 竖屏字号按 0.92 单独缩：正文套用 0.72 后字幕会偏小，手机上看不清
            fontSize: Math.round(CAPTION_METRICS.fontSize * (isPortrait ? 0.92 : 1)),
            fontFamily: FONT,
            fontWeight: FW.regular,
            textAlign: "center",
            borderRadius: RADIUS.pill,
            boxShadow: "0 10px 26px rgba(10,16,28,0.38), inset 0 1px 0 rgba(255,255,255,0.14)",
            letterSpacing: 0.6,
            textShadow: "0 2px 6px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: sp(16),
              top: sp(14),
              bottom: sp(14),
              width: 5,
              borderRadius: RADIUS.pill,
              background: `linear-gradient(180deg, ${C.accent}, ${alpha(C.accent, 40)})`,
            }}
          />
          {karaoke
            ? tokens.map((tk, i) => {
                const t0 = i / n;
                const lit = interpolate(p, [t0, Math.min(1, t0 + 0.12)], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const on = lit > 0.5;
                // 逐词扫光是连续的，但颜色曾经是硬切（lit > 0.5 才亮）：词与词之间没有过渡，
                // 观感像字幕在"一段一段地闪"。改成按 lit 插值亮度，扫过去是一条柔和的光带。
                // 注意这里仍然不碰 font-weight 与任何布局属性——那会让整句重排、左右跳。
                const ink = `rgba(255,255,255,${(0.42 + 0.58 * lit).toFixed(3)})`;
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline",
                      color: tk.num ? `color-mix(in srgb, ${HIGHLIGHT} ${Math.round(lit * 100)}%, ${ink})` : ink,
                      textShadow: on && tk.num ? `0 0 14px ${alpha(HIGHLIGHT, 55)}` : "none",
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
