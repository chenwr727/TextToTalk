import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, FS, RADIUS, BORDER, PILL_SHADOW, GLASS, ACCENT_GRAD } from "./theme";

export const PageHeading: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 90, width: "100%", display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{
          padding: "16px 46px", background: GLASS.pill, border: `${BORDER.card}px solid ${C.accent}`,
          borderRadius: RADIUS.pill, fontSize: FS.title, fontWeight: 800, color: C.accent,
          fontFamily: FONT, boxShadow: PILL_SHADOW, letterSpacing: 2,
        }}>
          {text}
        </div>
        <div style={{ position: "relative", width: 120, height: 6, borderRadius: RADIUS.pill, background: ACCENT_GRAD, boxShadow: "0 2px 8px rgba(39,111,245,0.35)" }}>
          <div style={{ position: "absolute", top: -3, left: -3, width: 12, height: 12, borderRadius: "50%", background: "#2fc6a1", boxShadow: "0 0 8px rgba(47,198,161,0.6)" }} />
          <div style={{ position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: C.accent, boxShadow: "0 0 8px rgba(59,111,245,0.6)" }} />
        </div>
      </div>
    </div>
  );
};