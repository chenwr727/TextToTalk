import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, HEADER_OFFSET, ANIM, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

export const StepsScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = points.length;
  const perRow = Math.min(4, n);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`, columnGap: 60, rowGap: 20, marginTop: HEADER_OFFSET, width: 1560 }}>
        {points.map((p, i) => {
          const t = springIn(f, fps, i * ANIM.stagger, page.motion);
          const a = accentOf(i);
          const isLast = i === n - 1;
          const isRowEnd = (i + 1) % perRow === 0;
          const showArrow = !isLast && !isRowEnd;
          return (
            <div key={i} style={{ position: "relative", minWidth: 0, opacity: t, transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)` }}>
              <div style={{
                height: "100%", padding: "34px 28px", textAlign: "center",
                background: GLASS.card, border: `${BORDER.card}px solid ${a}`, borderRadius: RADIUS.card, boxShadow: CARD_SHADOW,
                position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center",
              }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: a, color: "#fff", fontSize: FS.heading, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: SOLID_SHADOW, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: `${a}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i)} size={34} color={a} />
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: C.ink, lineHeight: 1.4, fontFamily: FONT, wordBreak: "break-word" }}>{pointText(p, i)}</div>
              </div>
              {showArrow && (
                <div style={{ position: "absolute", left: "100%", top: 0, bottom: 0, width: 60, display: "flex", alignItems: "center", justifyContent: "center", color: a, fontSize: 44, fontWeight: 800 }}>→</div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};