import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, FONT, FS, RADIUS, BORDER, PILL_SHADOW, TEXT_SHADOW, GLASS, springIn } from "../theme";
import { pointsText } from "../point";
import type { SceneProps } from "./types";

export const TitleScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const subtitle = pointsText(page.points || []);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = springIn(f, fps, 0, page.motion);
  const s = interpolate(f, [0, 26], [0.86, 1], { extrapolateRight: "clamp", output: "perceptual-scale" });
  const so = springIn(f, fps, 22, page.motion);
  const bar = interpolate(f, [10, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleChars = Array.from(title).length;
  const titleVisualWidth = Math.min(1680, Math.max(360, titleChars * 88));
  const accentBarW = Math.max(90, Math.min(180, titleVisualWidth * 0.18));
  const underlineW = Math.min(680, Math.max(220, titleVisualWidth * 0.95));

  const titleFontSize = titleChars > 18 ? 64 : titleChars > 14 ? 72 : 88;
  const titleLineHeight = 1.15;

  const typedChars = Math.floor(interpolate(f, [0, 40], [0, titleChars], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caretOpacity = interpolate(f % 16, [0, 8, 16], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ opacity: o, transform: `scale(${s})`, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ width: accentBarW * bar, height: 6, borderRadius: RADIUS.pill, background: `linear-gradient(90deg, ${C.accent}, ${C.accent}88)`, marginBottom: 30 }} />
        {page.effects?.threeD ? (
          <div style={{ perspective: 1000, width: "100%", display: "flex", justifyContent: "center" }}>
            <div style={{
              fontSize: titleFontSize,
              fontWeight: 800,
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
            fontWeight: 800,
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
            <UnderlinePath w={underlineW} progress={springIn(f, fps, 10, page.motion)} color={C.accent} />
          ) : (
            <path d={`M 6 14 C ${underlineW * 0.22} 4, ${underlineW * 0.6} 22, ${underlineW - 8} 10`} fill="none" stroke={C.accent} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
          )}
        </svg>
      </div>
      {subtitle && (
        <div style={{ position: "relative", marginTop: 40, opacity: so }}>
          <div style={{
            padding: "14px 38px",
            background: GLASS.pill,
            border: `${BORDER.card}px solid ${C.accent}`,
            borderRadius: RADIUS.pill,
            fontSize: FS.heading,
            color: C.sub,
            fontFamily: FONT,
            fontWeight: 600,
            boxShadow: PILL_SHADOW,
            maxWidth: 1500,
          }}>
            {subtitle}
          </div>
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
