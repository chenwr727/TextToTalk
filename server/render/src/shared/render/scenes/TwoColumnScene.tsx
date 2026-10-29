import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FW, LH, accentOf, SPACE, springIn } from "../theme";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const TwoColumnScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, sp, contentWidth, contentHeight } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();

  /*
   * 真的分两列。
   *
   * 原先 `points.map` 把**所有**条目都塞进左列，右列拿一块 420×420 的渐变方块 +
   * 一个居中小图标当填充：一页 4 条要点读不出"这是两组对照"，那块方块也只是占位符
   * （实测方块里 46% 是图标，周围是两层描边环 + 斜纹）。现在按条目数对半分，
   * 两列都渲染同样的卡片，一列一个强调色 —— "两种改法 / 前后对照"才立得住。
   */
  const half = Math.ceil(points.length / 2);
  const columns = [points.slice(0, half), points.slice(half)].filter((list) => list.length > 0);

  /*
   * 横屏把卡片块撑到正文带的 74%：卡高由内容决定时整块只有 350 高，
   * 贴着标题排之后下面会空出一大片（体检：空洞 280px -> 修好顶部又变成底部 330px 空白）。
   * 两列的卡改成 flex:1 平分这块高度，卡内文字仍居中对齐。
   */
  const bandH = Math.max(0, (isPortrait ? contentHeight : 1080) - contentTop - captionReserve);
  const blockH = isPortrait ? undefined : Math.round(bandH * 0.74);

  // 可用带：标题底 .. 字幕条顶（横竖两个方向同一套算法）
  const availH = Math.max(
    360,
    (isPortrait ? contentHeight : 1080) - contentTop - captionReserve - (isPortrait ? sp(24) : 40),
  );

  const boxW = isPortrait ? contentWidth : 1560;
  const colGap = isPortrait ? sp(36) : 48;
  const colW = (boxW - colGap * (columns.length - 1)) / Math.max(1, columns.length);

  const maxLen = points.reduce((m, p, i) => Math.max(m, [...pointText(p, i)].length), 0);
  const cardW = colW - (isPortrait ? sp(30) : 30) * 2 - (isPortrait ? sp(64) : 64) - (isPortrait ? sp(24) : 24);
  const byCountFs = points.length <= 2 ? 44 : points.length === 3 ? 40 : points.length === 4 ? 36 : 32;
  const estLines = Math.max(1, Math.ceil(maxLen / Math.max(6, Math.floor(cardW / (byCountFs * 1.05)))));
  const lenFactor = estLines <= 1 ? 1 : estLines === 2 ? 0.9 : estLines === 3 ? 0.8 : 0.72;
  const bodyFs = Math.max(24, Math.round(byCountFs * lenFactor * (isPortrait ? 1.05 : 1)));

  const gapOf = (fSize: number) => Math.max(12, Math.round(fSize * (isPortrait ? 0.62 : 0.66)));
  const padYOf = (fSize: number) => Math.max(14, Math.round(fSize * 0.66));
  /** 单列高度：一列只放它自己那几条，两列取较高的一列决定字号 */
  const colH = (list: typeof points, fSize: number) => {
    const innerW = cardW - Math.round(fSize * 1.75) - (isPortrait ? sp(24) : 24);
    return (
      list.reduce((sum, p, i) => {
        const lines = Math.max(
          1,
          Math.ceil([...pointText(p, i)].length / Math.max(4, Math.floor(innerW / (fSize * 1.05)))),
        );
        return sum + lines * fSize * 1.4 + padYOf(fSize) * 2;
      }, 0) +
      gapOf(fSize) * Math.max(0, list.length - 1)
    );
  };
  const measureH = (fSize: number) => Math.max(...columns.map((list) => colH(list, fSize)));

  let finalFs = bodyFs;
  for (let guard = 0; guard < 12 && measureH(finalFs) > availH && finalFs > 20; guard++) {
    finalFs = Math.max(20, finalFs - 2);
  }
  /*
   * 反向放大：这套适配原先只有"装不下就缩"，没有"太空就放"。
   * 竖屏实测只占可用带 35%（内容 504 / 可用 1440）；分两列之后每列只剩两张卡，
   * 横屏也只占 34%——两个方向都需要往上放。上限分开（竖屏 68 / 横屏 56），
   * 避免横屏把卡片撑成比标题还大。
   */
  const fsCap = isPortrait ? 80 : 56;
  // guard 原来是 16：每轮 +2 只能从 34 长到 64，连上面的 fsCap 都没碰到。
  for (let guard = 0; guard < 40 && measureH(finalFs) < availH * 0.58 && finalFs < fsCap; guard++) {
    finalFs += 2;
  }

  const gap = gapOf(finalFs);
  /** 一列作为一个整体入场：用该列第一条的时间锚点，避免两列逐个飞入显得散 */
  const enterOf = (list: typeof points, index: number) =>
    springIn(f, fps, resolveAnchor(timing, list[0] ? pointAnchor(list[0]) : undefined, index), page.motion);

  return (
    <AbsoluteFill
      style={{
        // 横屏贴标题排：标题绝对定位在顶部、内容却相对整块画布居中，实测中间白出 280px
        justifyContent: isPortrait ? "center" : "flex-start",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <PageHeading text={title} />
      <div
        style={{
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: colGap,
          marginTop: contentTop,
          marginBottom: isPortrait ? captionReserve : 0,
          width: boxW,
          alignItems: isPortrait ? "stretch" : "center",
          justifyContent: "center",
          maxHeight: isPortrait ? undefined : availH,
          height: blockH,
        }}
      >
        {columns.map((list, ci) => {
          const ac = accentOf(ci);
          const o = enterOf(list, 0);
          return (
            <div
              key={ci}
              style={{
                display: "flex",
                flexDirection: "column",
                gap,
                justifyContent: "center",
                height: blockH ? "100%" : undefined,
                /*
                 * 分界：横屏画一条竖向虚线，竖屏改成横向。
                 * 两列卡片本身长得一样，没有这条分隔线，观众只会看到"两列卡片"，
                 * 而这一页想说的是"两种做法/前后对照"。
                 */
                borderLeft: !isPortrait && ci > 0 ? `2px dashed ${alpha(ac, 26)}` : undefined,
                borderTop: isPortrait && ci > 0 ? `2px dashed ${alpha(ac, 26)}` : undefined,
                paddingLeft: !isPortrait && ci > 0 ? colGap / 2 : undefined,
                paddingTop: isPortrait && ci > 0 ? sp(28) : undefined,
                opacity: o,
                transform: isPortrait ? `translateY(${interpolate(o, [0, 1], [30, 0])}px)` : undefined,
              }}
            >
              {list.map((p, i) => {
                const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i), page.motion);
                const iconBox = Math.round(finalFs * 1.75);
                return (
                  <Card
                    key={i}
                    accent={ac}
                    leftBar
                    pad={isPortrait ? sp(24) : SPACE.md}
                    style={{
                      flexShrink: 0,
                      flex: blockH ? 1 : undefined,
                      opacity: t,
                      transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", marginTop: "auto", marginBottom: "auto" }}>
                      <IconTile
                        name={pointIcon(p, i)}
                        accent={ac}
                        size={iconBox > 60 ? "lg" : iconBox > 48 ? "md" : "sm"}
                        style={{ marginRight: isPortrait ? sp(24) : SPACE.md }}
                      />
                      <div
                        style={{
                          fontSize: finalFs,
                          fontWeight: FW.bold,
                          color: C.ink,
                          lineHeight: LH.body,
                          textWrap: "balance",
                          fontFamily: FONT,
                        }}
                      >
                        {pointText(p, i)}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
