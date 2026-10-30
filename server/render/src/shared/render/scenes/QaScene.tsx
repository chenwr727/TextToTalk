import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, LH, FW, SPACE, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve, estLines, portraitFill } from "../responsive";
import { surplusGap } from "../fit";
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
  const { contentTop } = useHeadingMetrics();
  const timing = useSceneTiming();
  const question = points[0] ? pointText(points[0], 0) : "";
  const answers = points.slice(1);

  /**
   * 竖屏稀疏页放大：一问一答这类内容量最少的页，实测只占可用内容带的 20%，
   * 上下各一大片空白。先估自然高度，再按目标填充率放大字号与间距。
   */
  const { zoom, qaSurplus } = (() => {
    if (!isPortrait) return { zoom: 1, qaSurplus: 0 };
    /*
     * 内宽要按「放大后的」内边距和问号圆章算。
     *
     * 这里原来用未放大的 sp(34) / sp(64)，但实际渲染用的是 sp(34*zi) / sp(64*zi)，
     * zi 封顶 1.3 —— 于是放大后内宽少了约 35px，估出来"放得下"、实际却折了行。
     */
    const ZI_CAP = 1.3;
    const padQ = sp(34 * ZI_CAP);
    const qInnerW = contentWidth - padQ * 2 - sp(64 * ZI_CAP) - sp(28);
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
    /*
     * 问句是这一页的主视觉，不能被折成「砍层级会不 / 会失控？」这种断在词中间的硬折行。
     * 按「问句单行放得下」反推放大上限，再留 8% 余量（CJK 字宽≈1em，估算容易贴着边界）。
     */
    const qChars = Array.from(question).length;
    const qFitCap = qChars > 0 ? (qInnerW * 0.92) / (qChars * qFs) : 2.35;
    const cap = Math.max(1.2, Math.min(2.35, qFitCap));
    const naturalH = qH + sp(32) + answersH;
    const zoomNow = portraitFill(naturalH, band, { max: cap, target: 0.62 });
    /*
     * 字号封顶在「问句不折行」，一问两答的页实测只占可用带 38%。
     * 剩下的竖向空间交给问答之间的间距（与 points 同一口径）。
     */
    const surplus = surplusGap(naturalH * zoomNow, band, Math.max(2, answers.length), {
      target: 0.78,
      maxGap: sp(120),
    });
    return { zoom: zoomNow, qaSurplus: surplus };
  })();
  /** 间距跟字号放大但更克制：字放大 1.5 倍时留白也放大 1.5 倍会显得散 */
  const zi = Math.min(zoom, 1.3);
  const iconSize = zoom > 1.22 ? "lg" : "md";

  const qO = springIn(f, fps, resolveAnchor(timing, points[0] ? pointAnchor(points[0]) : undefined, 0), page.motion);
  /** 横屏正文带：标题下沿到字幕条上沿。问卡从带顶起笔，答案卡分掉剩余高度 */
  const qaBandH = 1080 - contentTop - captionReserve;

  const a = accentOf(0);

  return (
    <AbsoluteFill
      style={{
        justifyContent: isPortrait ? "center" : "flex-start",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <PageHeading text={title} />
      {/*
       * 横屏改成“从 contentTop 起笔、答案卡分掉剩余高度”。
       *
       * 旧写法靠 AbsoluteFill 居中 + marginTop: 120：PageHeading 是绝对定位、不占文档流，
       * 于是“居中”是相对整块画布算的——实测 qa 样例页问卡落在 y=375，
       * 标题下方空 166px，答案卡下面又空 310px。
       * 现在：问卡跟着标题，答案卡列 flex: 1 分掉剩余高度，文字在卡内居中。
       */}
      <div
        style={{
          marginTop: isPortrait ? 0 : contentTop,
          marginBottom: isPortrait ? 0 : captionReserve,
          height: isPortrait ? undefined : qaBandH,
          display: "flex",
          flexDirection: "column",
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
            gap: isPortrait ? sp(24 * zi) + qaSurplus : SPACE.md,
            marginTop: isPortrait ? sp(32 * zi) + qaSurplus : SPACE.lg,
            // 横屏：剩余高度交给这一列，但卡片本身不无限拉高（见下方 maxHeight）
            flex: isPortrait ? undefined : 1,
            justifyContent: isPortrait ? undefined : "center",
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
                style={{
                  opacity: t,
                  transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
                  flex: isPortrait ? undefined : 1,
                  /*
                   * 卡片长高有上限：一句答案的卡被拉到 430px 高时，
                   * 卡内只有一行字、上下各空一半，看上去像“面板没装东西”。
                   * 260 是一行正文 + 两行正文都能安全装下的高度。
                   */
                  maxHeight: isPortrait ? undefined : 260,
                  display: isPortrait ? undefined : "flex",
                  flexDirection: isPortrait ? undefined : "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    // 卡被拉高时内容垂直居中（与 points / steps / stats 同一套）
                    marginTop: isPortrait ? undefined : "auto",
                    marginBottom: isPortrait ? undefined : "auto",
                  }}
                >
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
