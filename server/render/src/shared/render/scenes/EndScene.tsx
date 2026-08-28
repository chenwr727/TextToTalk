import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, CARD_SHADOW, DOT_SHADOW, TEXT_SHADOW, springIn } from "../theme";
import { pointText } from "../point";
import type { SceneProps } from "./types";

export const EndScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points || [];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = springIn(f, fps, 8, page.motion);
  const check = springIn(f, fps, 0, page.motion);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ marginBottom: 34, width: 90, height: 90, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, transform: `scale(${interpolate(check, [0, 1], [0.4, 1], { output: "perceptual-scale" })})`, opacity: check }}>
        <span style={{ color: "#fff", fontSize: FS.title, fontWeight: 800 }}>✓</span>
      </div>
      <div style={{ fontSize: 78, fontWeight: 800, color: C.ink, fontFamily: FONT, opacity: o, textShadow: TEXT_SHADOW }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 26, rowGap: 20, marginTop: 44, maxWidth: 1680, fontSize: FS.body, color: C.sub, fontFamily: FONT }}>
        {points.map((p, i) => (
          <span key={i} style={{ display: "inline-block", background: "rgba(59,111,245,0.10)", color: C.ink, padding: "10px 22px", borderRadius: RADIUS.pill, boxShadow: DOT_SHADOW }}>{pointText(p, i)}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
