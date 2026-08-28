import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BG_VARIANTS, DECOR, THEMES, DEFAULT_THEME, type ThemeId } from "./theme";

export const Bg: React.FC<{ variant: string; theme?: ThemeId }> = ({ variant, theme = DEFAULT_THEME }) => {
  const preset = THEMES[theme] || THEMES[DEFAULT_THEME];
  const v = (preset.bg[variant] || preset.bg.default || BG_VARIANTS[variant] || BG_VARIANTS.default);
  const isDark = theme === "dark";
  const f = useCurrentFrame();
  const leakX = interpolate(f % 240, [0, 240], [-0.4, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leakO = 0.5 + 0.2 * Math.sin((f / 240) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ background: v.grad }}>
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${DECOR.grid} 1px, transparent 1px), linear-gradient(90deg, ${DECOR.grid} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 78%)",
        }}
      />
      <div
        style={{
          position: "absolute", top: -160, right: -140, width: v.orb, height: v.orb,
          borderRadius: "50%", background: `radial-gradient(circle,${v.orbColor} 0%,transparent 70%)`, opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute", bottom: -220, left: -160, width: v.orb, height: v.orb,
          borderRadius: "50%", background: `radial-gradient(circle,${v.orbColor} 0%,transparent 70%)`, opacity: 0.4,
        }}
      />
      <div
        style={{
          position: "absolute", top: 120, right: 180, width: 300, height: 300,
          borderRadius: "50%", border: `2px solid ${DECOR.ring}`, opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute", top: 170, right: 230, width: 200, height: 200,
          borderRadius: "50%", border: `1.5px solid ${DECOR.ringAccent}`,
        }}
      />
      <div
        style={{
          position: "absolute", bottom: 60, left: 120, width: 420, height: 420,
          borderRadius: "50%", border: `2px solid ${DECOR.ring}`, opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute", bottom: 200, right: 260, width: 18, height: 18,
          borderRadius: "50%", background: DECOR.glow,
        }}
      />
      <div
        style={{
          position: "absolute", top: "-20%", left: `${leakX * 100}%`, width: "38%", height: "150%",
          transform: "rotate(18deg)", pointerEvents: "none", opacity: leakO,
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(120,160,255,0.10) 45%, rgba(255,180,120,0.08) 60%, transparent)"
            : "linear-gradient(90deg, transparent, rgba(120,160,255,0.14) 45%, rgba(255,190,140,0.10) 60%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.28) 100%), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%)"
            : "radial-gradient(ellipse at center, transparent 62%, rgba(28,37,54,0.10) 100%), linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 28%)",
        }}
      />
    </AbsoluteFill>
  );
};