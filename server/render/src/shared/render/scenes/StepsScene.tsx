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
  const { fps } = useVideoConfig();
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

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
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
