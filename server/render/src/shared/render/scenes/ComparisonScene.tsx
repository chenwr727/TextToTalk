import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FS, FW, LH, RADIUS, accentOf, SPACE, tileShadow, springIn, pickCardFont } from "../theme";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

const CARD_PAD_X = 44;
const CARD_PAD_BOTTOM = 32;
const HEAD_PAD_TOP = SPACE.lg;
const HEAD_PAD_BOTTOM = SPACE.md;
const DIVIDER_BLOCK = 21;
const ITEM_GAP_MIN = 22;
const ICON_BOX = 44;

export const ComparisonScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const { contentTop } = useHeadingMetrics();
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

  /*
   * 卡片宽度按可用宽度算，不再写死 580。
   *
   * 580×2 + 96(VS) + 72(gap) = 1328，只占 1920 的 69%；竖屏则相反——
   * 卡片撑满 1080 但里面只有 3 条短句，下半截全是空的。
   */
  const vsSize = isPortrait ? sp(96) : 96;
  const cardGap = isPortrait ? sp(24) : 36;
  const cardW = isPortrait ? contentWidth : Math.min(760, Math.floor((contentWidth - vsSize - cardGap * 2) / 2));

  const compareItems = sides ? [...leftItems.slice(skipFirst), ...rightItems.slice(skipFirst)] : items.slice(skipFirst);
  const maxItemLen = Math.max(1, ...compareItems.map((p) => [...pointText(p, 0)].length));
  const textW = cardW - CARD_PAD_X * 2 - ICON_BOX - SPACE.sm;
  const baseFs = pickCardFont(maxItemLen, textW);

  const linesOf = (text: string, fSize: number) =>
    Math.max(1, Math.ceil([...text].length / Math.max(4, Math.floor(textW / (fSize * 1.02)))));
  /** 列表实际需要的高度：每个条目取「图标方块 44」与「文字行高」的较大值 */
  const listHOf = (list: typeof items, fSize: number) => {
    const n = Math.max(list.length - skipFirst, 0);
    if (!n) return 0;
    const blocks = list.slice(skipFirst).reduce((sum, p, i) => {
      const h = linesOf(pointText(p, i), fSize) * fSize * LH.body;
      return sum + Math.max(ICON_BOX, h);
    }, 0);
    return blocks + (n - 1) * ITEM_GAP_MIN;
  };
  const neededH = (fSize: number) =>
    HEAD_PAD_TOP +
    56 +
    HEAD_PAD_BOTTOM +
    DIVIDER_BLOCK +
    Math.max(listHOf(leftItems, fSize), listHOf(rightItems, fSize)) +
    CARD_PAD_BOTTOM;

  /*
   * 上下留白预算。
   *
   * 原来 `CARD_PAD_TOP = 80`（实际头部内边距是 SPACE.lg=32）把卡片高度多算了 84px，
   * 于是内容只有 330px 高、卡片却画 410px，底部空出一整条。现在按实际内容给高度，
   * 并把富余的高度用 space-between 摊到条目间距里。
   */
  const bandH = isPortrait
    ? contentHeight - captionReserve - sp(210) - vsSize - cardGap * 2
    : 1080 - contentTop - captionReserve - 60;

  let itemFs = baseFs;
  for (let guard = 0; guard < 20 && neededH(itemFs + 2) <= bandH * 0.94 * 0.88 && itemFs < 52; guard++) {
    itemFs += 2;
  }
  /*
   * 卡片高度上限：横屏 1.35 倍内容高，竖屏只给 1.18 倍。
   *
   * 卡片里是 space-between，富余高度全摊成条目间距。竖屏两张卡上下叠、每张 2 条要点时，
   * 1.35 倍意味着卡高 470、两条要点一条贴着卡头一条贴着卡底，**中间空 150px+**——看着像
   * 两条要点不属于同一张卡。收窄到 1.18 后间距回到 ~70px，仍比贴着紧凑好看。
   */
  const stretch = isPortrait ? 1.18 : 1.35;
  const cardH = Math.max(neededH(itemFs), Math.min(bandH * 0.94, neededH(itemFs) * stretch));

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
        display: "flex",
        opacity: op,
        flex: isPortrait ? undefined : 1,
        width: isPortrait ? "100%" : undefined,
        transform: `translateY(${interpolate(op, [0, 1], [72, 0])}px)`,
      }}
    >
      <Card
        accent={accent}
        topBar
        pad={0}
        style={{ width: isPortrait ? contentWidth : cardW, minHeight: cardH, height: "100%" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${HEAD_PAD_TOP}px ${CARD_PAD_X}px ${HEAD_PAD_BOTTOM}px ${CARD_PAD_X}px`,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <IconTile name={icon} accent={accent} size="md" />
            <div
              style={{
                // 卡片标题跟着条目字号走：条目顶到 46 之后，28px 的标题会被正文压住，层级反了
                fontSize: Math.max(FS.body, Math.round(itemFs * 0.82)),
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // 富余高度摊到条目之间，而不是全留在卡底
            justifyContent: "space-between",
            gap: ITEM_GAP_MIN,
            flex: 1,
            padding: `0 ${CARD_PAD_X}px ${CARD_PAD_BOTTOM}px ${CARD_PAD_X}px`,
          }}
        >
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
                style={{
                  fontSize: itemFs,
                  color: C.ink,
                  lineHeight: LH.body,
                  fontFamily: FONT,
                  fontWeight: FW.regular,
                  textWrap: "balance",
                }}
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
          gap: cardGap,
          // 竖屏原来用一个拍出来的 212px，标题下多空出一整块
          marginTop: contentTop,
          marginBottom: captionReserve,
          alignItems: "stretch",
          justifyContent: "center",
          width: isPortrait ? contentWidth : undefined,
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
            width: vsSize,
            height: vsSize,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 28px ${C.accentFaint}`,
            opacity: enterVs,
            transform: `scale(${interpolate(enterVs, [0, 1], [0.4, 1])}) rotate(${interpolate(enterVs, [0, 1], [-90, 0])}deg)`,
            alignSelf: "center",
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
