import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { makeSpark } from "@remotion/shapes";
import { C, FONT, FONT_DISPLAY, FS, LH, FW, accentOf, SPACE, springIn } from "../theme";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { HandUnderline } from "../rough";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const StatsScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const { height: canvasH } = useVideoConfig();
  // 竖屏每行放两个卡，3 个数据就会变成「两个 + 一个半宽」的怪排布（最后一张孤零零居中）。
  // 3 个数据时竖屏改为一列铺满，读起来才整齐。
  const portraitCols = points.length === 3 ? 1 : 2;
  const timing = useSceneTiming();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  /*
   * 横屏单行卡片的行高：由正文带（标题底 → 字幕条上沿）的高度推出来，再设个上限，
   * 免得 3 张卡被拉成竖条。竖屏维持原样（自己按最小高度排）。
   */
  const bandH = Math.max(0, canvasH - captionReserve - contentTop);
  const statRowH =
    !isPortrait && points.length > 0 && points.length <= 4 ? Math.min(420, Math.round(bandH * 0.74)) : undefined;

  const extractNum = (s: string): { num: string; rest: string } => {
    const m = s.match(/[-+]?\d+(?:\.\d+)?\s*[%％倍xX]?/);
    if (m) {
      const num = m[0].trim();
      const rest = s.replace(m[0], "").trim();
      return { num, rest };
    }
    return { num: "", rest: s };
  };

  return (
    <AbsoluteFill
      style={{
        // 竖屏也贴标题排：卡片只有 3 张时，原来的垂直居中会在标题下方留 400px+ 的空洞；
        // 5 张以上单列可能排不下，这时退回居中，宁可上下留白也不要压到字幕条
        justifyContent: isPortrait ? "center" : "flex-start",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <PageHeading text={title} />
      <div
        style={{
          display: "flex",
          flexWrap: isPortrait ? "wrap" : "nowrap",
          gap: isPortrait ? sp(24) : 24,
          marginTop: contentTop,
          // 本场景此前完全没消费字幕预留，三张卡直接顶到字幕条上（实测只剩 52px）
          marginBottom: isPortrait ? captionReserve : 0,
          width: isPortrait ? contentWidth : 1560,
          justifyContent: "center",
          alignItems: "stretch",
          /*
           * 横屏原来整组卡片在画布里垂直居中，标题绝对定位在顶部，于是卡片浮在中间：
           * 实测 bbox y=478..809、上方空 278px（e2e 体检里 `04-stats` fill 只有 46%）。
           * 现在从 contentTop 起笔，单行时再用正文带高度推一个行高，卡片贴着标题、也不缩成一条。
           */
          height: statRowH,
        }}
      >
        {points.map((p, i) => {
          const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i), page.motion);
          const a = accentOf(i);
          const { num, rest } = extractNum(pointText(p, i));
          return (
            <Card
              key={i}
              accent={a}
              pad={isPortrait ? sp(32) : SPACE.lg}
              style={{
                /*
                 * 横屏原来写死 `calc(25% - 24px)`——那是按 4 张卡算的，3 个数据只填满 1560 的
                 * 75%（1170px），两侧各空 377px。改成按实际张数平分。
                 */
                flex: isPortrait
                  ? `0 1 calc(${100 / portraitCols}% - 12px)`
                  : `0 1 calc(${100 / Math.max(1, points.length)}% - 24px)`,
                minWidth: isPortrait ? 0 : 300,
                textAlign: "center",
                opacity: t,
                transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)`,
              }}
            >
              {/* 卡片被 `statRowH` 拉高后，图标+数字+说明靠 `margin: auto 0` 在卡内垂直居中 */}
              <div style={{ marginTop: "auto", marginBottom: "auto" }}>
                <div
                  style={{ display: "flex", justifyContent: "center", marginBottom: isPortrait ? sp(20) : SPACE.md }}
                >
                  <IconTile name={pointIcon(p, i)} accent={a} size="lg" />
                </div>
                <div
                  style={{
                    position: "relative",
                    fontSize: isPortrait ? fs(FS.hero) : FS.hero,
                    fontWeight: FW.heavy,
                    color: a,
                    lineHeight: LH.tight,
                    fontFamily: FONT_DISPLAY,
                    marginBottom: isPortrait ? sp(12) : 12,
                    minHeight: isPortrait ? sp(96) : 96,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {num ? (
                    page.effects?.annotation === "underline" ? (
                      <HandUnderline
                        color={a}
                        progress={springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i) + 6, page.motion)}
                        strokeWidth={10}
                        iterations={2}
                      >
                        {num}
                      </HandUnderline>
                    ) : (
                      num
                    )
                  ) : (
                    "—"
                  )}
                  {num && (
                    <SparkBadge
                      color={a}
                      progress={springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i) + 10, page.motion)}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: isPortrait ? fs(FS.caption) : FS.caption,
                    fontWeight: FW.regular,
                    color: C.ink,
                    lineHeight: LH.body,
                    fontFamily: FONT,
                    width: "100%",
                  }}
                >
                  {rest}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SparkBadge: React.FC<{ color: string; progress: number }> = ({ color, progress }) => {
  const { path } = makeSpark({ width: 40, height: 40, edgeRoundness: 0.6 });
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 40 40"
      style={{
        position: "absolute",
        /*
         * 星形徽标贴到数字右上角。
         * 卡片改成按张数平分后宽度有 520px，原来的 right:-14 直接贴在卡片外边缘，
         * 跟居中的数字隔了 200px，看起来像漂在空中。改用百分比定位跟着文字块走。
         */
        top: -14,
        right: "18%",
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [0.3, 1], { output: "perceptual-scale" })}) rotate(${interpolate(progress, [0, 1], [-30, 0])}deg)`,
      }}
    >
      <path d={path} fill={color} />
    </svg>
  );
};
