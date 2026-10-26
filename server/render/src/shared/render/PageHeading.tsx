import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, FW, RADIUS, BORDER, PILL_SHADOW, GLASS, ACCENT_GRAD, useTheme } from "./theme";
import { useResponsive } from "./responsive";

/**
 * 页面标题。
 *
 * 标题形态是主题的一部分：pill（胶囊）/ bar（左侧竖线）/ plain（纯文字 + 细下划线），
 * 三种形态的对齐、字号、字距也由主题给，所以换主题时这里是最明显的差异点之一。
 */
export const PageHeading: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { isPortrait, fs, sp } = useResponsive();
  const t = useTheme();
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (!text) return null;

  const size = isPortrait ? fs(t.heading.size) : t.heading.size;
  const isPill = t.heading.style === "pill";
  const center = t.heading.align === "center";

  const type: CSSProperties = {
    fontSize: size,
    fontWeight: FW.heavy,
    lineHeight: 1.2,
    color: isPill ? C.accent : C.ink,
    fontFamily: FONT,
    letterSpacing: `${t.heading.letterSpacing}px`,
  };

  const rule =
    t.heading.style === "pill" ? (
      <div
        style={{
          position: "relative",
          width: isPortrait ? sp(120) : 120,
          height: 6,
          borderRadius: RADIUS.pill,
          background: ACCENT_GRAD,
          boxShadow: `0 2px 8px ${C.accentFaint}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -3,
            left: -3,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: t.gradEnd,
            boxShadow: `0 0 8px ${C.accentSoft}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: C.accent,
            boxShadow: `0 0 8px ${C.accentSoft}`,
          }}
        />
      </div>
    ) : (
      <div
        style={{
          width: t.heading.style === "bar" ? "100%" : isPortrait ? sp(160) : 160,
          height: t.heading.style === "bar" ? 3 : 2,
          borderRadius: RADIUS.pill,
          background: t.heading.style === "bar" ? `${ACCENT_GRAD}` : C.accentSoft,
          opacity: 0.9,
        }}
      />
    );

  return (
    <div
      style={{
        position: "absolute",
        top: isPortrait ? sp(90) : 90,
        left: center ? 0 : isPortrait ? sp(64) : 120,
        right: center ? 0 : isPortrait ? sp(64) : 120,
        display: "flex",
        justifyContent: center ? "center" : "flex-start",
        opacity: o,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: center ? "center" : "flex-start",
          gap: isPortrait ? sp(16) : 16,
          maxWidth: "100%",
        }}
      >
        {isPill ? (
          <div
            style={{
              ...type,
              padding: `${isPortrait ? sp(16) : 16}px ${isPortrait ? sp(46) : 46}px`,
              background: GLASS.pill,
              border: `${BORDER.card}px solid ${C.accent}`,
              borderRadius: RADIUS.pill,
              boxShadow: PILL_SHADOW,
            }}
          >
            {text}
          </div>
        ) : t.heading.style === "bar" ? (
          <div style={{ display: "flex", alignItems: "center", gap: isPortrait ? sp(18) : 18, maxWidth: "100%" }}>
            <div
              style={{
                width: 8,
                height: size * 1.1,
                borderRadius: 4,
                background: ACCENT_GRAD,
                flexShrink: 0,
              }}
            />
            <div style={{ ...type }}>{text}</div>
          </div>
        ) : (
          <div style={{ ...type }}>{text}</div>
        )}
        {rule}
      </div>
    </div>
  );
};
