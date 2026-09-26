import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, FONT, FS, FW, LH, RADIUS, HEADER_OFFSET, accentOf, springIn, BORDER, GLASS, CARD_SHADOW, SOLID_SHADOW, pickCardFont } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

const CARD_W = 580;
const CARD_PAD_X = 44;
const CARD_PAD_TOP = 80;
const CARD_PAD_BOTTOM = 36;
const HEAD_H = 64;
const ITEM_GAP = 22;
const ICON_BOX = 44;

export const ComparisonScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const captionTexts = page.sentences && page.sentences.length
    ? page.sentences.map((s) => s.text)
    : page.captions ?? [];
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();

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

  const compareItems = sides
    ? [...leftItems.slice(skipFirst), ...rightItems.slice(skipFirst)]
    : items.slice(skipFirst);
  const maxItemLen = Math.max(1, ...compareItems.map((p) => [...pointText(p, 0)].length));
  const itemFs = pickCardFont(maxItemLen, isPortrait ? contentWidth : CARD_W - CARD_PAD_X * 2);
  const lineH = LH.body;
  const itemBlockH = (isPortrait ? sp(ICON_BOX) : ICON_BOX) + (isPortrait ? sp(16) : 16);
  const listH = maxCount > 0 ? maxCount * itemBlockH + (maxCount - 1) * (isPortrait ? sp(ITEM_GAP) : ITEM_GAP) : 0;
  const cardH = (isPortrait ? sp(CARD_PAD_TOP) : CARD_PAD_TOP) + (isPortrait ? sp(HEAD_H) : HEAD_H) + (isPortrait ? sp(28) : 28) + listH + (isPortrait ? sp(CARD_PAD_BOTTOM) : CARD_PAD_BOTTOM);

  const tA = resolveAnchor(timing, leftItems[0] ? pointAnchor(leftItems[0]) : undefined, 0, 8);
  const tB = resolveAnchor(timing, rightItems[0] ? pointAnchor(rightItems[0]) : undefined, 1, 22);
  const enterA = springIn(f, fps, tA, page.motion);
  const enterB = springIn(f, fps, tB, page.motion);
  const enterVs = spring({ frame: f - (tB - 16), fps, config: { damping: 9, stiffness: 110, mass: 0.8 } });
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
          position: "relative",
          width: isPortrait ? contentWidth : CARD_W,
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
            <div style={{ fontSize: FS.body, fontWeight: FW.heavy, color: C.ink, lineHeight: LH.tight, fontFamily: FONT, letterSpacing: 1 }}>{heading}</div>
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
              fontSize: FS.label,
              fontWeight: FW.heavy,
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
                  color: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                  fontSize: Math.round(ICON_BOX * 0.5),
                  fontWeight: FW.heavy,
                  fontFamily: FONT,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: itemFs, color: C.ink, lineHeight: lineH, fontFamily: FONT, fontWeight: FW.regular }}>{pointText(p, i)}</div>
            </div>
          ))}
        </div>
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
      <div style={{ position: "relative", display: "flex", flexDirection: isPortrait ? "column" : "row", gap: isPortrait ? sp(24) : 36, marginTop: isPortrait ? sp(HEADER_OFFSET) : HEADER_OFFSET, marginBottom: captionReserve, alignItems: "center" }}>
        {panel(enterA, left, accentLeft, leftItems[0] ? pointIcon(leftItems[0], 0) : "check", leftItems, "✓", tA + 12, badgeLeft)}

        <div
          style={{
            position: "relative",
            width: isPortrait ? sp(96) : 96,
            height: isPortrait ? sp(96) : 96,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}, ${C.accent}cc)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 28px ${C.accent}55`,
            opacity: enterVs,
            transform: `scale(${interpolate(enterVs, [0, 1], [0.4, 1])}) rotate(${interpolate(enterVs, [0, 1], [-90, 0])}deg)`,
            zIndex: 2,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: isPortrait ? fs(FS.caption) : FS.caption, fontWeight: FW.heavy, color: "#fff", fontFamily: FONT, letterSpacing: 2 }}>VS</div>
        </div>

        {panel(enterB, right, accentRight, rightItems[0] ? pointIcon(rightItems[0], half) : "alert", rightItems, "!", tB + 10, badgeRight)}
      </div>
    </AbsoluteFill>
  );
};
