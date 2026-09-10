import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";

export const TwoColumnScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const a = accentOf(0);

  const leftO = springIn(f, fps, 0, page.motion);
  const rightO = springIn(f, fps, ANIM.stagger, page.motion);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ display: "flex", flexDirection: isPortrait ? "column" : "row", gap: isPortrait ? sp(64) : 64, marginTop: isPortrait ? 0 : HEADER_OFFSET, width: isPortrait ? contentWidth : 1560, alignItems: "stretch" }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: isPortrait ? sp(24) : 24, height: isPortrait ? sp(900) : 640, justifyContent: "center", overflow: "hidden", opacity: leftO, transform: `translateX(${interpolate(leftO, [0, 1], [-40, 0])}px)` }}>
          {points.map((p, i) => {
            const t = springIn(f, fps, i * ANIM.stagger, page.motion);
            const ac = accentOf(i);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: `${isPortrait ? sp(40) : 26}px ${isPortrait ? sp(30) : 30}px`, flexShrink: 0,
                height: isPortrait ? Math.floor((sp(900) - (points.length - 1) * sp(24)) / points.length) : undefined,
                background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: 20, boxShadow: CARD_SHADOW,
                opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{ width: isPortrait ? sp(64) : 64, height: isPortrait ? sp(64) : 64, borderRadius: 16, background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: isPortrait ? sp(24) : 24, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i)} size={isPortrait ? sp(34) : 34} color={ac} />
                </div>
                <div style={{ fontSize: isPortrait ? fs(40) : 40, fontWeight: 700, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{pointText(p, i)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: rightO, transform: `translateX(${interpolate(rightO, [0, 1], [40, 0])}px)` }}>
          <div style={{
            width: isPortrait ? sp(560) : 420, height: isPortrait ? sp(560) : 420, borderRadius: isPortrait ? sp(56) : 40, background: `linear-gradient(150deg, ${a}22, ${a}0a)`,
            border: `${BORDER.card}px solid ${a}55`, boxShadow: CARD_SHADOW,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: isPortrait ? sp(280) : 200, height: isPortrait ? sp(280) : 200, borderRadius: isPortrait ? 60 : 50, background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SOLID_SHADOW }}>
              <Icon name={pointIcon(points[0] ?? "", 0)} size={isPortrait ? sp(150) : 110} color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};