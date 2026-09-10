import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, FS, RADIUS, BORDER, PILL_SHADOW, GLASS, ACCENT_GRAD } from "./theme";
import { useResponsive } from "./responsive";

export const PageHeading: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { isPortrait, fs, sp } = useResponsive();
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: isPortrait ? sp(90) : 90, width: "100%", display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: isPortrait ? sp(16) : 16 }}>
        <div style={{
          padding: `${isPortrait ? sp(16) : 16}px ${isPortrait ? sp(46) : 46}px`, background: GLASS.pill, border: `${BORDER.card}px solid ${C.accent}`,
          borderRadius: RADIUS.pill, fontSize: isPortrait ? fs(FS.title) : FS.title, fontWeight: 800, color: C.accent,
          fontFamily: FONT, boxShadow: PILL_SHADOW, letterSpacing: 2,
        }}>
          {text}
        </div>
        <div style={{ position: "relative", width: isPortrait ? sp(120) : 120, height: 6, borderRadius: RADIUS.pill, background: ACCENT_GRAD, boxShadow: "0 2px 8px rgba(39,111,245,0.35)" }}>
          <div style={{ position: "absolute", top: -3, left: -3, width: 12, height: 12, borderRadius: "50%", background: "#2fc6a1", boxShadow: "0 0 8px rgba(47,198,161,0.6)" }} />
          <div style={{ position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: C.accent, boxShadow: "0 0 8px rgba(59,111,245,0.6)" }} />
        </div>
      </div>
    </div>
  );
};