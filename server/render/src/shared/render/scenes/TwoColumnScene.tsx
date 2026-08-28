import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

export const TwoColumnScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = accentOf(0);

  const leftO = springIn(f, fps, 0, page.motion);
  const rightO = springIn(f, fps, ANIM.stagger, page.motion);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ display: "flex", gap: 64, marginTop: HEADER_OFFSET, width: 1560, alignItems: "stretch" }}>
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 24, maxHeight: 640, justifyContent: "center", overflow: "hidden", opacity: leftO, transform: `translateX(${interpolate(leftO, [0, 1], [-40, 0])}px)` }}>
          {points.map((p, i) => {
            const t = springIn(f, fps, i * ANIM.stagger, page.motion);
            const ac = accentOf(i);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: "26px 30px", flexShrink: 0,
                background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: 20, boxShadow: CARD_SHADOW,
                opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 24, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i)} size={34} color={ac} />
                </div>
                <div style={{ fontSize: 40, fontWeight: 700, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{pointText(p, i)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: rightO, transform: `translateX(${interpolate(rightO, [0, 1], [40, 0])}px)` }}>
          <div style={{
            width: 420, height: 420, borderRadius: 40, background: `linear-gradient(150deg, ${a}22, ${a}0a)`,
            border: `${BORDER.card}px solid ${a}55`, boxShadow: CARD_SHADOW,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 200, height: 200, borderRadius: 50, background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SOLID_SHADOW }}>
              <Icon name={pointIcon(points[0] ?? "", 0)} size={110} color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};