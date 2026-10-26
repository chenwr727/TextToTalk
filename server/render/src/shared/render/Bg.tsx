import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DECOR, THEME_TOKENS, DEFAULT_THEME, normalizeThemeId, type ThemeId } from "./theme";

export const Bg: React.FC<{ variant: string; theme?: ThemeId; draw?: boolean }> = ({
  variant,
  theme = DEFAULT_THEME,
  draw = false,
}) => {
  const tokens = THEME_TOKENS[normalizeThemeId(theme)];
  const v = tokens.bg[variant] || tokens.bg.default;
  const isDark = tokens.dark;
  const f = useCurrentFrame();
  const leakX = interpolate(f % 240, [0, 240], [-0.4, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leakO = 0.5 + 0.2 * Math.sin((f / 240) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ background: v.grad }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${DECOR.grid} 1px, transparent 1px), linear-gradient(90deg, ${DECOR.grid} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 78%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -160,
          right: -140,
          width: v.orb,
          height: v.orb,
          borderRadius: "50%",
          background: `radial-gradient(circle,${v.orbColor} 0%,transparent 70%)`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -220,
          left: -160,
          width: v.orb,
          height: v.orb,
          borderRadius: "50%",
          background: `radial-gradient(circle,${v.orbColor} 0%,transparent 70%)`,
          opacity: 0.4,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 180,
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `2px solid ${DECOR.ring}`,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 170,
          right: 230,
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `1.5px solid ${DECOR.ringAccent}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 120,
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: `2px solid ${DECOR.ring}`,
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 200,
          right: 260,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: DECOR.glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: `${leakX * 100}%`,
          width: "38%",
          height: "150%",
          transform: "rotate(18deg)",
          pointerEvents: "none",
          opacity: leakO,
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(120,160,255,0.10) 45%, rgba(255,180,120,0.08) 60%, transparent)"
            : "linear-gradient(90deg, transparent, rgba(120,160,255,0.14) 45%, rgba(255,190,140,0.10) 60%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.28) 100%), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%)"
            : "radial-gradient(ellipse at center, transparent 62%, rgba(28,37,54,0.10) 100%), linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 28%)",
        }}
      />
      {draw ? <DrawDecor color={v.orbColor} /> : null}
    </AbsoluteFill>
  );
};

/**
 * effects.pathDraw：把装饰环 / 装饰线"画"出来。
 *
 * 用 pathLength={1} 把任意路径长度归一化为 1，再配合 strokeDasharray=1 与
 * strokeDashoffset=1-progress，就不必测量真实路径长度（getTotalLength 在无头渲染里不可靠）。
 */
const DrawDecor: React.FC<{ color: string }> = ({ color }) => {
  const f = useCurrentFrame();
  const ring = interpolate(f, [0, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = interpolate(f, [10, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dash = (p: number) => ({ strokeDasharray: 1, strokeDashoffset: 1 - p });

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {[
        { cx: 1520, cy: 300, r: 260, w: 3, o: 0.5, p: ring },
        { cx: 1520, cy: 300, r: 186, w: 2, o: 0.3, p: ring },
        { cx: 330, cy: 830, r: 150, w: 2, o: 0.28, p: line },
      ].map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill="none"
          stroke={color}
          strokeWidth={c.w}
          strokeLinecap="round"
          opacity={c.o}
          pathLength={1}
          {...dash(c.p)}
        />
      ))}
      <path
        d="M 140 700 C 520 640, 900 760, 1480 690"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.26}
        pathLength={1}
        {...dash(line)}
      />
    </svg>
  );
};
