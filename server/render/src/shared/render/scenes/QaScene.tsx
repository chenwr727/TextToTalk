import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, RADIUS, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

export const QaScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const question = points[0] ? pointText(points[0], 0) : "";
  const answers = points.slice(1);

  const qO = springIn(f, fps, 0, page.motion);
  const a = accentOf(0);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ marginTop: HEADER_OFFSET, width: 1560 }}>
        <div style={{
          display: "flex", alignItems: "center", padding: "34px 40px",
          background: `linear-gradient(135deg, ${a}1f, ${a}0a)`, border: `${BORDER.card}px solid ${a}66`, borderRadius: RADIUS.card, boxShadow: CARD_SHADOW,
          opacity: qO, transform: `translateY(${interpolate(qO, [0, 1], [30, 0])}px)`,
        }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: a, color: "#fff", fontSize: 40, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 28, flexShrink: 0, boxShadow: SOLID_SHADOW }}>?</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{question}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
          {answers.map((p, i) => {
            const t = springIn(f, fps, (i + 1) * ANIM.stagger, page.motion);
            const ac = accentOf(i + 1);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: "24px 32px",
                background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: 20, boxShadow: CARD_SHADOW,
                opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 22, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i + 1)} size={30} color={ac} />
                </div>
                <div style={{ fontSize: 36, fontWeight: 600, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{pointText(p, i + 1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};