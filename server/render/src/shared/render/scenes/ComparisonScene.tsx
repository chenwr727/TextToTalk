import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, HEADER_OFFSET, DOT_SHADOW, accentOf, springIn } from "../theme";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

export const ComparisonScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = springIn(f, fps, 8, page.motion);
  const b = springIn(f, fps, 22, page.motion);

  const sides = page.comparisonSides;
  const half = Math.ceil(items.length / 2);
  const leftItems = sides ? sides.a.points : items.slice(0, half);
  const rightItems = sides ? sides.b.points : items.slice(half);
  const left = sides ? sides.a.label : (leftItems[0] ? pointText(leftItems[0], 0) : "…");
  const right = sides ? sides.b.label : (rightItems[0] ? pointText(rightItems[0], half) : "…");
  const skipFirst = !sides ? 1 : 0;

  const leftCount = leftItems.length - skipFirst;
  const rightCount = rightItems.length - skipFirst;
  const maxCount = Math.max(leftCount, rightCount);
  const itemH = 100;
  const listGap = 18;
  const listH = maxCount > 0 ? maxCount * itemH + (maxCount - 1) * listGap : 0;
  const cardH = 34 * 2 + 60 + listH + 40;

  const panel = (op: number, heading: string, accent: string, icon: string, list: typeof items) => (
    <div style={{ position: "relative", opacity: op, transform: `translateY(${interpolate(op, [0, 1], [72, 0])}px)` }}>
      <Card accent={accent} topBar style={{
        width: 520, height: cardH, padding: "34px 40px", position: "relative", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, marginTop: 6 }}>
          <div style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DOT_SHADOW }}>
            <Icon name={icon} size={30} color={accent} />
          </div>
          <div style={{ fontSize: FS.heading, fontWeight: 800, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{heading}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: listGap, flex: 1 }}>
          {list.slice(skipFirst).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                <Icon name={pointIcon(p, i)} size={22} color={accent} />
              </div>
              <div style={{ fontSize: 28, color: C.ink, lineHeight: 1.4, fontFamily: FONT }}>{pointText(p, i)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ position: "relative", display: "flex", gap: 60, marginTop: HEADER_OFFSET }}>
        <div style={{ position: "absolute", top: -30, left: -50, right: -50, bottom: -30, borderRadius: RADIUS.card, background: "linear-gradient(180deg, rgba(59,111,245,0.06) 0%, rgba(59,111,245,0) 100%)", opacity: Math.max(a, b), pointerEvents: "none" }} />
        {panel(a, left, accentOf(0), leftItems[0] ? pointIcon(leftItems[0], 0) : "check", leftItems)}
        {panel(b, right, accentOf(1), rightItems[0] ? pointIcon(rightItems[0], half) : "alert", rightItems)}
      </div>
    </AbsoluteFill>
  );
};