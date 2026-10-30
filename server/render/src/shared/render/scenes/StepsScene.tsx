import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, FW, CARD_TYPE, pickCardFont, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { IconTile } from "../IconTile";
import { Card } from "../Card";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const StepsScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps, height: canvasH } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();
  const n = points.length;
  const perRow = isPortrait ? 1 : Math.min(4, n);
  const maxChars = Math.max(1, ...points.map((p, i) => [...pointText(p, i)].length));
  const cardW = (isPortrait ? contentWidth : 1560) / perRow;
  const stepsFs = pickCardFont(maxChars, cardW - (isPortrait ? sp(28) : 28) * 2 - 40);
  /*
   * 横屏原来把整组卡片放在画布里垂直居中，标题是绝对定位的，于是「标题底 → 卡片顶」
   * 白出 200~240px（e2e 体检：`03-steps` 空洞 240px，占正文带 33%）。
   * 现在改成从 `contentTop` 起笔，并给单行卡片一个由正文带高度推出来的行高：
   * 卡片既贴着标题，又不会因为只有一行而缩成一条。
   */
  const bandH = Math.max(0, canvasH - captionReserve - contentTop);
  const singleRow = !isPortrait && n <= perRow;
  /* 0.74 + 470 上限时正文只到 y=720（带底 920），正好卡在 200px 的告警线上；抬到 0.92 + 520 留出余量 */
  const rowH = singleRow ? Math.min(520, Math.round(bandH * 0.92)) : undefined;
  /*
   * 竖屏：单列时把每张卡拉高到正文带。
   * 原来靠 `minHeight: sp(250)` 兑位，实测 473..1448 下方还空 242px。
   */
  const portraitRowH =
    isPortrait && n > 0
      ? Math.max(sp(250), Math.min(sp(430), Math.round((bandH * 0.94 - sp(48) * (n - 1)) / n)))
      : undefined;

  return (
    <AbsoluteFill
      style={{
        // 竖屏也贴标题排：卡片只有 3 张时，原来的垂直居中会在标题下方留 400px+ 的空洞；
        // 5 张以上单列可能排不下，这时退回居中，宁可上下留白也不要压到字幕条
        /*
         * 竖屏也改成从上往下排（原来是 center）。
         * `marginTop: contentTop` 在 `justifyContent: center` 下是无效的：子元素的 margin box
         * 还是被整块画布居中，竖屏实测正文落在 473..1448（标题下空 297px）。
         */
        justifyContent: "flex-start",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <PageHeading text={title} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
          gridTemplateRows: rowH ? `${rowH}px` : portraitRowH ? `repeat(${n}, ${portraitRowH}px)` : undefined,
          columnGap: isPortrait ? sp(60) : 60,
          // 竖屏 4 张卡原来只隔 17px、整组像一块石板；且 marginTop 用了 212px，上方空 363px
          rowGap: isPortrait ? sp(48) : 20,
          marginTop: contentTop,
          marginBottom: captionReserve,
          width: isPortrait ? contentWidth : 1560,
        }}
      >
        {points.map((p, i) => {
          const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i), page.motion);
          const a = accentOf(i);
          const isLast = i === n - 1;
          const isRowEnd = (i + 1) % perRow === 0;
          const showArrow = !isLast && !isRowEnd;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                minWidth: 0,
                opacity: t,
                transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)`,
              }}
            >
              <Card
                pad={isPortrait ? sp(34) : 34}
                // 竖屏给一个最小高度：4 张单行卡只有 190px 高，整组只占画布 44%
                style={{ height: "100%", textAlign: "center", minHeight: isPortrait ? sp(250) : undefined }}
              >
                {/* 序号原来是"64px 实心圆 + 64px 图标方块"竖向堆两个，把卡片撑满、正文被挤成窄条。
                    现在序号缩成右上角 40px 徽标，主视觉只留一个图标方块，正文多出约 84px 高度 */}
                <div
                  style={{
                    position: "absolute",
                    top: isPortrait ? sp(16) : 16,
                    right: isPortrait ? sp(16) : 16,
                    width: isPortrait ? sp(44) : 44,
                    height: isPortrait ? sp(44) : 44,
                    borderRadius: "50%",
                    background: a,
                    color: "#fff",
                    fontSize: isPortrait ? fs(FS.label) : FS.label,
                    fontWeight: FW.heavy,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: SOLID_SHADOW,
                    zIndex: 2,
                  }}
                >
                  {i + 1}
                </div>
                {/* 卡片比内容高时（上面推出来的 `rowH`），图标+正文靠 `margin: auto 0` 在卡内垂直居中，
                    否则会全部挤在卡片上半截 */}
                <div style={{ marginTop: "auto", marginBottom: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: isPortrait ? sp(18) : 18 }}>
                    <IconTile name={pointIcon(p, i)} accent={a} size="lg" />
                  </div>
                  <div
                    style={{
                      fontSize: isPortrait ? fs(stepsFs) : stepsFs,
                      fontWeight: FW.bold,
                      color: C.ink,
                      lineHeight: CARD_TYPE.lineHeight,
                      fontFamily: FONT,
                      wordBreak: "break-word",
                    }}
                  >
                    {pointText(p, i)}
                  </div>
                </div>
              </Card>
              {showArrow && (
                <div
                  style={{
                    position: "absolute",
                    left: "100%",
                    top: 0,
                    bottom: 0,
                    width: isPortrait ? sp(60) : 60,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    // 箭头不再跟卡片轮换颜色（7 个版式里那三处“杂色”就是这么来的）
                    color: C.accent,
                    fontSize: isPortrait ? fs(56) : 56,
                    fontWeight: FW.heavy,
                  }}
                >
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
