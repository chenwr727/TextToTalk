import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, FONT, RADIUS, HEADER_OFFSET, accentOf, springIn, BORDER, GLASS, CARD_SHADOW, SOLID_SHADOW } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

const CARD_W = 580;
const CARD_PAD_X = 44;
const CARD_PAD_TOP = 80;
const CARD_PAD_BOTTOM = 36;
const HEAD_H = 64;
const ITEM_GAP = 22;
const ICON_BOX = 44;

export const ComparisonScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  const fitItemFs = (text: string) => {
    const len = [...text].length;
    if (len <= 14) return 32;
    if (len <= 20) return 28;
    if (len <= 28) return 26;
    return 24;
  };

  const itemFs = Math.min(
    ...((sides ? [...leftItems.slice(skipFirst), ...rightItems.slice(skipFirst)] : items.slice(skipFirst))
      .map((p) => fitItemFs(pointText(p, 0)))),
    32
  );
  const lineH = 1.45;
  const itemBlockH = ICON_BOX + 16;
  const listH = maxCount > 0 ? maxCount * itemBlockH + (maxCount - 1) * ITEM_GAP : 0;
  const cardH = CARD_PAD_TOP + HEAD_H + 28 + listH + CARD_PAD_BOTTOM;

  const enterA = springIn(f, fps, 8, page.motion);
  const enterB = springIn(f, fps, 22, page.motion);
  const enterVs = spring({ frame: f - 38, fps, config: { damping: 9, stiffness: 110, mass: 0.8 } });
  const enterBadge = (delay: number) => spring({ frame: f - delay, fps, config: { damping: 10, stiffness: 130, mass: 0.7 } });

  const panel = (
    op: number,
    heading: string,
    accent: string,
    icon: string,
    list: typeof items,
    badgeText: string,
    badgeDelay: number,
    badgeColor: string
  ) => (
    <div
      style={{
        position: "relative",
        opacity: op,
        transform: `translateY(${interpolate(op, [0, 1], [72, 0])}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -28,
          borderRadius: RADIUS.card + 10,
          background: `radial-gradient(ellipse at 50% 30%, ${accent}26 0%, ${accent}00 70%)`,
          pointerEvents: "none",
          opacity: enterBadge(badgeDelay),
        }}
      />

      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: cardH,
          background: GLASS.card,
          border: `${BORDER.card}px solid ${accent}`,
          borderRadius: RADIUS.card,
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: `linear-gradient(90deg, ${accent}, ${accent}88 60%, ${accent}33)` }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "48%", background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 3, borderRadius: RADIUS.card - 3, border: "1px solid rgba(255,255,255,0.6)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `36px ${CARD_PAD_X}px 18px ${CARD_PAD_X}px`, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 10px ${accent}33`, flexShrink: 0 }}>
              <Icon name={icon} size={32} color={accent} />
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, lineHeight: 1.3, fontFamily: FONT, letterSpacing: 1 }}>{heading}</div>
          </div>

          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${badgeColor}, ${badgeColor}cc)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              fontFamily: FONT,
              boxShadow: `0 6px 18px ${badgeColor}66`,
              transform: `scale(${interpolate(enterBadge(badgeDelay), [0, 1], [0.4, 1])})`,
              opacity: enterBadge(badgeDelay),
              flexShrink: 0,
            }}
          >
            {badgeText}
          </div>
        </div>

        <div style={{ margin: `0 ${CARD_PAD_X}px 20px ${CARD_PAD_X}px`, height: 1, background: `linear-gradient(90deg, ${accent}55 0%, ${accent}11 50%, transparent 100%)` }} />

        <div style={{ display: "flex", flexDirection: "column", gap: ITEM_GAP, padding: `0 ${CARD_PAD_X}px` }}>
          {list.slice(skipFirst).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: ICON_BOX,
                  height: ICON_BOX,
                  borderRadius: 12,
                  background: `${accent}14`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Icon name={pointIcon(p, i)} size={26} color={accent} />
              </div>
              <div style={{ fontSize: itemFs, color: C.ink, lineHeight: lineH, fontFamily: FONT, fontWeight: 500 }}>{pointText(p, i)}</div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", left: CARD_PAD_X, right: CARD_PAD_X, bottom: 14, height: 4, borderRadius: "0 0 8px 8px", background: `linear-gradient(90deg, transparent 4%, ${accent}99 50%, transparent 96%)`, opacity: 0.8 }} />
      </div>
    </div>
  );

  const accentLeft = accentOf(0);
  const accentRight = accentOf(1);
  const badgeLeft = "#2fc6a1";
  const badgeRight = "#f2a93b";

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ position: "relative", display: "flex", gap: 36, marginTop: HEADER_OFFSET, alignItems: "center" }}>
        <div style={{ position: "absolute", top: -36, left: -80, right: -80, bottom: -36, borderRadius: RADIUS.card + 24, background: "linear-gradient(180deg, rgba(59,111,245,0.08) 0%, rgba(59,111,245,0) 100%)", opacity: Math.max(enterA, enterB), pointerEvents: "none" }} />

        {panel(enterA, left, accentLeft, leftItems[0] ? pointIcon(leftItems[0], 0) : "check", leftItems, "✓", 20, badgeLeft)}

        <div
          style={{
            position: "relative",
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, #ffffff 0%, #ffffff 60%, ${C.accent}1a 100%)`,
            border: `3px solid ${C.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: SOLID_SHADOW,
            opacity: enterVs,
            transform: `scale(${interpolate(enterVs, [0, 1], [0.4, 1])}) rotate(${interpolate(enterVs, [0, 1], [-90, 0])}deg)`,
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 900, color: C.accent, fontFamily: FONT, letterSpacing: 2 }}>VS</div>
        </div>

        {panel(enterB, right, accentRight, rightItems[0] ? pointIcon(rightItems[0], half) : "alert", rightItems, "!", 32, badgeRight)}
      </div>
    </AbsoluteFill>
  );
};
