import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, LH, FW, SPACE, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { PageHeading } from "../PageHeading";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve, estLines, portraitFill } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

/** 竖屏标题区（PageHeading + 间距）占用的竖向空间，估算内容带时要扣掉 */
const PORTRAIT_HEADING_RESERVE = 260;

export const QaScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const captionReserve = useCaptionReserve(subtitles, page.captions);
  const timing = useSceneTiming();
  const question = points[0] ? pointText(points[0], 0) : "";
  const answers = points.slice(1);

  /**
   * 竖屏稀疏页放大：一问一答这类内容量最少的页，实测只占可用内容带的 20%，
   * 上下各一大片空白。先估自然高度，再按目标填充率放大字号与间距（封顶 1.55）。
   */
  const zoom = (() => {
    if (!isPortrait) return 1;
    const padQ = sp(34);
    const qInnerW = contentWidth - padQ * 2 - sp(64) - sp(28);
    const qFs = fs(FS.title);
    const qLines = estLines(question, qFs, qInnerW, FW.heavy);
    const qH = padQ * 2 + Math.max(sp(64), Math.round(qLines * qFs * LH.tight));

    const padA = sp(28);
    const aInnerW = contentWidth - padA * 2 - 56 - sp(24);
    const aFs = fs(FS.body);
    const answersH =
      answers.reduce((sum, p, i) => {
        const lines = estLines(pointText(p, i + 1), aFs, aInnerW, FW.regular);
        return sum + padA * 2 + Math.max(56, Math.round(lines * aFs * LH.body));
      }, 0) +
      sp(24) * Math.max(0, answers.length - 1);

    const band = contentHeight - PORTRAIT_HEADING_RESERVE - captionReserve;
    return portraitFill(qH + sp(32) + answersH, band, { max: 1.85, target: 0.55 });
  })();
  /** 间距跟字号放大但更克制：字放大 1.5 倍时留白也放大 1.5 倍会显得散 */
  const zi = Math.min(zoom, 1.3);
  const iconSize = zoom > 1.22 ? "lg" : "md";

  const qO = springIn(f, fps, resolveAnchor(timing, points[0] ? pointAnchor(points[0]) : undefined, 0), page.motion);
  const a = accentOf(0);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      {/*
        * 原来 marginTop 用一个写死的 250px 顶下去、却完全不消费字幕预留：
        * 两段卡挤在 y496-824（画布 30%），上方空 263px、下方离字幕条只剩 74px。
        * 交给 AbsoluteFill 的居中，上下留白由字幕预留决定。
        */}
      <div
        style={{
          marginTop: isPortrait ? 0 : 120,
          marginBottom: isPortrait ? 0 : captionReserve,
          width: isPortrait ? contentWidth : 1560,
        }}
      >
        <Card
          accent={a}
          topBar
          pad={isPortrait ? sp(34 * zi) : 34}
          style={{ opacity: qO, transform: `translateY(${interpolate(qO, [0, 1], [30, 0])}px)` }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: isPortrait ? sp(64 * zi) : 64,
                height: isPortrait ? sp(64 * zi) : 64,
                borderRadius: "50%",
                background: a,
                color: "#fff",
                fontSize: isPortrait ? fs(Math.round(FS.heading * zi)) : FS.heading,
                fontWeight: FW.heavy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: isPortrait ? sp(28) : 28,
                flexShrink: 0,
                boxShadow: SOLID_SHADOW,
              }}
            >
              ?
            </div>
            <div
              style={{
                fontSize: isPortrait ? fs(Math.round(FS.title * zoom)) : FS.title,
                fontWeight: FW.heavy,
                color: C.ink,
                lineHeight: LH.tight,
                textWrap: "balance",
                fontFamily: FONT,
              }}
            >
              {question}
            </div>
          </div>
        </Card>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isPortrait ? sp(24 * zi) : SPACE.md,
            marginTop: isPortrait ? sp(32 * zi) : SPACE.lg,
          }}
        >
          {answers.map((p, i) => {
            const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i + 1), page.motion);
            const ac = accentOf(i + 1);
            return (
              <Card
                key={i}
                accent={ac}
                leftBar
                pad={isPortrait ? sp(28 * zi) : 28}
                style={{ opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <IconTile
                    name={pointIcon(p, i + 1)}
                    accent={ac}
                    size={isPortrait ? iconSize : "md"}
                    style={{ marginRight: isPortrait ? sp(24 * zi) : SPACE.md }}
                  />
                  <div
                    style={{
                      fontSize: isPortrait ? fs(Math.round(FS.body * zoom)) : FS.body,
                      fontWeight: FW.regular,
                      color: C.ink,
                      lineHeight: LH.body,
                      textWrap: "balance",
                      fontFamily: FONT,
                    }}
                  >
                    {pointText(p, i + 1)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
