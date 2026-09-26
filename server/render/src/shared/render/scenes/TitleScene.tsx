import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, FONT, FS, FW, LH, RADIUS, BORDER, PILL_SHADOW, TEXT_SHADOW, GLASS, springIn, accentOf } from "../theme";
import { Icon } from "../Icon";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const TitleScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const subPoints = page.points || [];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const captionTexts = page.sentences && page.sentences.length
    ? page.sentences.map((s) => s.text)
    : page.captions ?? [];
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();
  const t0 = timing.frameAt(0);
  const o = springIn(f, fps, t0, page.motion);
  const s = interpolate(f, [t0, t0 + 26], [0.86, 1], { extrapolateRight: "clamp", output: "perceptual-scale" });
  const bar = interpolate(f, [t0 + 10, t0 + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleChars = Array.from(title).length;
  const titleVisualWidth = isPortrait
    ? Math.min(contentWidth, Math.max(300, titleChars * fs(88)))
    : Math.min(1680, Math.max(360, titleChars * 88));
  const accentBarW = Math.max(90, Math.min(180, titleVisualWidth * 0.18));
  const underlineW = Math.min(680, Math.max(220, titleVisualWidth * 0.95));

  const titleFontSize = isPortrait
    ? (titleChars > 18 ? 40 : titleChars > 14 ? 46 : 56)
    : (titleChars > 18 ? 64 : titleChars > 14 ? 72 : 88);
  const titleLineHeight = LH.tight;

  const typedChars = Math.floor(interpolate(f, [t0, t0 + 40], [0, titleChars], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caretOpacity = interpolate(f % 16, [0, 8, 16], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingBottom: captionReserve }}>
      <div style={{ opacity: o, transform: `scale(${s})`, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ width: accentBarW * bar, height: 6, borderRadius: RADIUS.pill, background: `linear-gradient(90deg, ${C.accent}, ${C.accent}88)`, marginBottom: sp(30) }} />
        {page.effects?.threeD ? (
          <div style={{ perspective: 1000, width: "100%", display: "flex", justifyContent: "center" }}>
            <div style={{
              fontSize: titleFontSize,
              fontWeight: FW.heavy,
              textAlign: "center",
              maxWidth: "92%",
              fontFamily: FONT,
              lineHeight: titleLineHeight,
              letterSpacing: 1,
              color: C.ink,
              textShadow: TEXT_SHADOW,
              transform: `rotateX(${interpolate(s, [0, 1], [28, 0])}deg) translateZ(${interpolate(s, [0, 1], [-40, 0])}px)`,
              transformStyle: "preserve-3d",
            }}>
              {title}
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: titleFontSize,
            fontWeight: FW.heavy,
            textAlign: "center",
            maxWidth: "92%",
            fontFamily: FONT,
            lineHeight: titleLineHeight,
            letterSpacing: 1,
            color: C.ink,
            textShadow: TEXT_SHADOW,
          }}>
            {title.slice(0, typedChars)}
            <span style={{ opacity: caretOpacity, color: C.accent }}>▌</span>
          </div>
        )}
        <svg
          width={underlineW}
          height={22}
          viewBox={`0 0 ${underlineW} 22`}
          preserveAspectRatio="none"
          style={{ marginTop: 6, opacity: o }}
        >
          {page.effects?.pathDraw ? (
            <UnderlinePath w={underlineW} progress={springIn(f, fps, t0 + 10, page.motion)} color={C.accent} />
          ) : (
            <path d={`M 6 14 C ${underlineW * 0.22} 4, ${underlineW * 0.6} 22, ${underlineW - 8} 10`} fill="none" stroke={C.accent} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
          )}
        </svg>
      </div>
      {subPoints.length > 0 && (
        <div style={{
          marginTop: sp(40),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: sp(18),
          width: isPortrait ? contentWidth : 1500,
        }}>
          {subPoints.map((p, i) => {
            const text = pointText(p, i);
            if (!text) return null;
            const delay = resolveAnchor(timing, pointAnchor(p), i, 0, 6) + 10;
            const itemO = springIn(f, fps, delay, page.motion);
            const ac = accentOf(i);
            const len = [...text].length;
            const base = isPortrait ? fs(FS.body) : FS.heading;
            const fsItem = Math.round(base * (len <= 18 ? 1 : len <= 26 ? 0.92 : 0.84));
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center",
                  padding: `${sp(14)}px ${sp(34)}px`,
                  background: GLASS.pill,
                  border: `${BORDER.card}px solid ${ac}55`,
                  borderRadius: RADIUS.pill,
                  boxShadow: PILL_SHADOW,
                  opacity: itemO,
                  transform: `translateY(${interpolate(itemO, [0, 1], [18, 0])}px)`,
                  maxWidth: isPortrait ? contentWidth : Math.min(1500, contentWidth),
                }}
              >
                <div style={{
                  width: sp(30), height: sp(30), borderRadius: "50%",
                  background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: sp(14), flexShrink: 0,
                }}>
                  <Icon name={pointIcon(p, i)} size={sp(18)} color={ac} />
                </div>
                <div style={{ fontSize: fsItem, color: C.sub, fontFamily: FONT, fontWeight: FW.regular, lineHeight: LH.tight }}>
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

const UnderlinePath: React.FC<{ w: number; progress: number; color: string }> = ({ w, progress, color }) => {
  const d = `M 6 14 C ${w * 0.22} 4, ${w * 0.6} 22, ${w - 8} 10`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeLinecap="round"
      opacity={0.85}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
    />
  );
};
