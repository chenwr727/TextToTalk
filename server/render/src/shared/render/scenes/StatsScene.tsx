import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { makeSpark } from "@remotion/shapes";
import { C, FONT, FONT_DISPLAY, FS, LH, FW, HEADER_OFFSET, accentOf, SPACE, springIn } from "../theme";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { HandUnderline } from "../rough";
import { useResponsive } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const StatsScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  // 竖屏每行放两个卡，3 个数据就会变成「两个 + 一个半宽」的怪排布（最后一张孤零零居中）。
  // 3 个数据时竖屏改为一列铺满，读起来才整齐。
  const portraitCols = points.length === 3 ? 1 : 2;
  const timing = useSceneTiming();

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
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          display: "flex",
          flexWrap: isPortrait ? "wrap" : "nowrap",
          gap: isPortrait ? sp(24) : 24,
          marginTop: isPortrait ? 0 : HEADER_OFFSET,
          width: isPortrait ? contentWidth : 1560,
          justifyContent: "center",
          alignItems: "stretch",
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
                flex: isPortrait ? `0 1 calc(${100 / portraitCols}% - 12px)` : "0 1 calc(25% - 24px)",
                minWidth: isPortrait ? 0 : 300,
                textAlign: "center",
                opacity: t,
                transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: isPortrait ? sp(20) : SPACE.md }}>
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
        top: -18,
        right: -14,
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [0.3, 1], { output: "perceptual-scale" })}) rotate(${interpolate(progress, [0, 1], [-30, 0])}deg)`,
      }}
    >
      <path d={path} fill={color} />
    </svg>
  );
};
