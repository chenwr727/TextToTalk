import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, RADIUS, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";

export const QaScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const question = points[0] ? pointText(points[0], 0) : "";
  const answers = points.slice(1);

  const qO = springIn(f, fps, 0, page.motion);
  const a = accentOf(0);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ marginTop: isPortrait ? 0 : HEADER_OFFSET, width: isPortrait ? contentWidth : 1560 }}>
        <div style={{
          display: "flex", alignItems: "center", padding: `${isPortrait ? sp(34) : 34}px ${isPortrait ? sp(40) : 40}px`,
          background: `linear-gradient(135deg, ${a}1f, ${a}0a)`, border: `${BORDER.card}px solid ${a}66`, borderRadius: RADIUS.card, boxShadow: CARD_SHADOW,
          opacity: qO, transform: `translateY(${interpolate(qO, [0, 1], [30, 0])}px)`,
        }}>
          <div style={{ width: isPortrait ? sp(72) : 72, height: isPortrait ? sp(72) : 72, borderRadius: "50%", background: a, color: "#fff", fontSize: isPortrait ? fs(40) : 40, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginRight: isPortrait ? sp(28) : 28, flexShrink: 0, boxShadow: SOLID_SHADOW }}>?</div>
          <div style={{ fontSize: isPortrait ? fs(48) : 48, fontWeight: 800, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{question}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: isPortrait ? sp(20) : 20, marginTop: isPortrait ? sp(28) : 28 }}>
          {answers.map((p, i) => {
            const t = springIn(f, fps, (i + 1) * ANIM.stagger, page.motion);
            const ac = accentOf(i + 1);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: `${isPortrait ? sp(24) : 24}px ${isPortrait ? sp(32) : 32}px`,
                background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: 20, boxShadow: CARD_SHADOW,
                opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{ width: isPortrait ? sp(56) : 56, height: isPortrait ? sp(56) : 56, borderRadius: 14, background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: isPortrait ? sp(22) : 22, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i + 1)} size={isPortrait ? sp(30) : 30} color={ac} />
                </div>
                <div style={{ fontSize: isPortrait ? fs(36) : 36, fontWeight: 600, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{pointText(p, i + 1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};