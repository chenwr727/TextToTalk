import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { makeSpark } from "@remotion/shapes";
import { C, FONT, RADIUS, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import { HandUnderline } from "../rough";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";

export const StatsScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();

  const extractNum = (s: string): { num: string; rest: string } => {
    const m = s.match(/[-+]?\d+(?:\.\d+)?\s*[%％倍xX]?/);
    if (m) {
      const num = m[0].trim();
      const rest = s.replace(m[0], "").trim();
      return { num, rest };
    }
    return { num: "", rest: s };
  };

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ display: "flex", flexWrap: isPortrait ? "wrap" : "nowrap", gap: isPortrait ? sp(24) : 24, marginTop: isPortrait ? 0 : HEADER_OFFSET, width: isPortrait ? contentWidth : 1560, justifyContent: "center", alignItems: "stretch" }}>
        {points.map((p, i) => {
          const t = springIn(f, fps, i * ANIM.stagger, page.motion);
          const a = accentOf(i);
          const { num, rest } = extractNum(pointText(p, i));
          return (
            <div key={i} style={{
              flex: isPortrait ? "0 1 calc(50% - 12px)" : "0 1 calc(25% - 24px)", minWidth: isPortrait ? 0 : 300, padding: `${isPortrait ? sp(32) : 32}px ${isPortrait ? sp(28) : 28}px ${isPortrait ? sp(36) : 36}px`, textAlign: "center",
              background: GLASS.card, border: `${BORDER.card}px solid ${a}`, borderRadius: RADIUS.card, boxShadow: CARD_SHADOW,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
              opacity: t, transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)`,
            }}>
              <div style={{ width: isPortrait ? sp(64) : 64, height: isPortrait ? sp(64) : 64, borderRadius: 16, background: `${a}1a`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", flexShrink: 0 }}>
                <Icon name={pointIcon(p, i)} size={isPortrait ? sp(34) : 34} color={a} />
              </div>
              <div style={{ position: "relative", fontSize: isPortrait ? fs(88) : 88, fontWeight: 800, color: a, lineHeight: 1.1, fontFamily: FONT, marginBottom: isPortrait ? sp(12) : 12, minHeight: isPortrait ? sp(96) : 96, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {num ? (
                  page.effects?.annotation === "underline" ? (
                    <HandUnderline color={a} progress={springIn(f, fps, i * ANIM.stagger + 6, page.motion)} strokeWidth={10} iterations={2}>
                      {num}
                    </HandUnderline>
                  ) : num
                ) : "—"}
                {num && (
                  <SparkBadge color={a} progress={springIn(f, fps, i * ANIM.stagger + 10, page.motion)} />
                )}
              </div>
              <div style={{ fontSize: isPortrait ? fs(30) : 30, fontWeight: 600, color: C.ink, lineHeight: 1.4, fontFamily: FONT, width: "100%" }}>{rest}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SparkBadge: React.FC<{ color: string; progress: number }> = ({ color, progress }) => {
  const { path } = makeSpark({ width: 40, height: 40, edgeRoundness: 0.6 });
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 40 40"
      style={{
        position: "absolute", top: -18, right: -14,
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [0.3, 1], { output: "perceptual-scale" })}) rotate(${interpolate(progress, [0, 1], [-30, 0])}deg)`,
      }}
    >
      <path d={path} fill={color} />
    </svg>
  );
};