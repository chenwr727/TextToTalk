import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, CARD_SHADOW, DOT_SHADOW, TEXT_SHADOW, springIn } from "../theme";
import { pointText } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";

export const EndScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points || [];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const t0 = timing.frameAt(0);
  const o = springIn(f, fps, t0 + 8, page.motion);
  const check = springIn(f, fps, t0, page.motion);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ marginBottom: sp(34), width: sp(90), height: sp(90), borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, transform: `scale(${interpolate(check, [0, 1], [0.4, 1], { output: "perceptual-scale" })})`, opacity: check }}>
        <span style={{ color: "#fff", fontSize: isPortrait ? fs(FS.title) : FS.title, fontWeight: 800 }}>✓</span>
      </div>
      <div style={{ fontSize: isPortrait ? fs(78) : 78, fontWeight: 800, color: C.ink, fontFamily: FONT, opacity: o, textShadow: TEXT_SHADOW }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: sp(26), rowGap: sp(20), marginTop: sp(44), maxWidth: isPortrait ? contentWidth : 1680, fontSize: isPortrait ? fs(FS.body) : FS.body, color: C.sub, fontFamily: FONT }}>
        {points.map((p, i) => (
          <span key={i} style={{ display: "inline-block", background: "rgba(59,111,245,0.10)", color: C.ink, padding: `${sp(10)}px ${sp(22)}px`, borderRadius: RADIUS.pill, boxShadow: DOT_SHADOW }}>{pointText(p, i)}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
