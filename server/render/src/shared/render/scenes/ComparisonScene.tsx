import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import {
  alpha,
  C,
  FONT,
  FS,
  FW,
  LH,
  RADIUS,
  HEADER_OFFSET,
  accentOf,
  SPACE,
  tileShadow,
  springIn,
  pickCardFont,
} from "../theme";
import { PageHeading } from "../PageHeading";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
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
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();

  const sides = page.comparisonSides;
  const half = Math.ceil(items.length / 2);
  const leftItems = sides ? sides.a.points : items.slice(0, half);
  const rightItems = sides ? sides.b.points : items.slice(half);
  const left = sides ? sides.a.label : leftItems[0] ? pointText(leftItems[0], 0) : "…";
  const right = sides ? sides.b.label : rightItems[0] ? pointText(rightItems[0], half) : "…";
  const skipFirst = !sides ? 1 : 0;

  const leftCount = leftItems.length - skipFirst;
  const rightCount = rightItems.length - skipFirst;
  const maxCount = Math.max(leftCount, rightCount);

  const compareItems = sides ? [...leftItems.slice(skipFirst), ...rightItems.slice(skipFirst)] : items.slice(skipFirst);
  const maxItemLen = Math.max(1, ...compareItems.map((p) => [...pointText(p, 0)].length));
  const itemFs = pickCardFont(maxItemLen, isPortrait ? contentWidth : CARD_W - CARD_PAD_X * 2);
  const lineH = LH.body;
  const itemBlockH = (isPortrait ? sp(ICON_BOX) : ICON_BOX) + (isPortrait ? sp(16) : 16);
  const listH = maxCount > 0 ? maxCount * itemBlockH + (maxCount - 1) * (isPortrait ? sp(ITEM_GAP) : ITEM_GAP) : 0;
  const cardH =
    (isPortrait ? sp(CARD_PAD_TOP) : CARD_PAD_TOP) +
    (isPortrait ? sp(HEAD_H) : HEAD_H) +
    (isPortrait ? sp(28) : 28) +
    listH +
    (isPortrait ? sp(CARD_PAD_BOTTOM) : CARD_PAD_BOTTOM);

  const tA = resolveAnchor(timing, leftItems[0] ? pointAnchor(leftItems[0]) : undefined, 0, 8);
  const tB = resolveAnchor(timing, rightItems[0] ? pointAnchor(rightItems[0]) : undefined, 1, 22);
  const enterA = springIn(f, fps, tA, page.motion);
  const enterB = springIn(f, fps, tB, page.motion);
  const enterVs = springIn(f, fps, tB - 16, page.motion);
  const enterBadge = (delay: number) => springIn(f, fps, delay, page.motion);

  const panel = (
    op: number,
    heading: string,
    accent: string,
    icon: string,
    list: typeof items,
    badgeText: string,
    badgeDelay: number,
    badgeColor: string,
  ) => (
    <div
      style={{
        position: "relative",
        opacity: op,
        transform: `translateY(${interpolate(op, [0, 1], [72, 0])}px)`,
      }}
    >
      {/* 这张卡原来是 Card.tsx 的 1:1 复制品（只是 topBar 高 10、高光 48%），
          改一处就得改两处。现在统一用 <Card topBar>，材质与其它版式一致 */}
      <Card accent={accent} topBar pad={0} style={{ width: isPortrait ? contentWidth : CARD_W, height: cardH }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.lg}px ${CARD_PAD_X}px ${SPACE.md}px ${CARD_PAD_X}px`,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <IconTile name={icon} accent={accent} size="md" />
            <div
              style={{
                fontSize: FS.body,
                fontWeight: FW.heavy,
                color: C.ink,
                lineHeight: LH.tight,
                fontFamily: FONT,
                letterSpacing: 1,
              }}
            >
              {heading}
            </div>
          </div>

          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${badgeColor}, ${alpha(badgeColor, 80)})`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: FS.label,
              fontWeight: FW.heavy,
              fontFamily: FONT,
              boxShadow: tileShadow(badgeColor),
              transform: `scale(${interpolate(enterBadge(badgeDelay), [0, 1], [0.4, 1])})`,
              opacity: enterBadge(badgeDelay),
              flexShrink: 0,
            }}
          >
            {badgeText}
          </div>
        </div>

        <div
          style={{
            margin: `0 ${CARD_PAD_X}px 20px ${CARD_PAD_X}px`,
            height: 1,
            background: `linear-gradient(90deg, ${alpha(accent, 33)} 0%, ${alpha(accent, 7)} 50%, transparent 100%)`,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: ITEM_GAP, padding: `0 ${CARD_PAD_X}px` }}>
          {list.slice(skipFirst).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.sm }}>
              <div
                style={{
                  width: ICON_BOX,
                  height: ICON_BOX,
                  borderRadius: RADIUS.chip,
                  background: alpha(accent, 10),
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
              <div
                style={{ fontSize: itemFs, color: C.ink, lineHeight: lineH, fontFamily: FONT, fontWeight: FW.regular }}
              >
                {pointText(p, i)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const accentLeft = accentOf(0);
  const accentRight = accentOf(1);
  // 徽标色曾是 "#2fc6a1"/"#f2a93b"（tech 主题 accents[1]/[2] 的副本），换主题不跟随
  const badgeLeft = accentOf(1);
  const badgeRight = accentOf(2);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? sp(24) : 36,
          marginTop: isPortrait ? sp(HEADER_OFFSET) : HEADER_OFFSET,
          marginBottom: captionReserve,
          alignItems: "center",
        }}
      >
        {panel(
          enterA,
          left,
          accentLeft,
          leftItems[0] ? pointIcon(leftItems[0], 0) : "check",
          leftItems,
          "✓",
          tA + 12,
          badgeLeft,
        )}

        <div
          style={{
            position: "relative",
            width: isPortrait ? sp(96) : 96,
            height: isPortrait ? sp(96) : 96,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 28px ${C.accentFaint}`,
            opacity: enterVs,
            transform: `scale(${interpolate(enterVs, [0, 1], [0.4, 1])}) rotate(${interpolate(enterVs, [0, 1], [-90, 0])}deg)`,
            zIndex: 2,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: isPortrait ? fs(FS.caption) : FS.caption,
              fontWeight: FW.heavy,
              color: "#fff",
              fontFamily: FONT,
              letterSpacing: 2,
            }}
          >
            VS
          </div>
        </div>

        {panel(
          enterB,
          right,
          accentRight,
          rightItems[0] ? pointIcon(rightItems[0], half) : "alert",
          rightItems,
          "!",
          tB + 10,
          badgeRight,
        )}
      </div>
    </AbsoluteFill>
  );
};
