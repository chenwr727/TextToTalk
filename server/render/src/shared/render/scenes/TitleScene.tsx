import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import {
  alpha,
  C,
  FONT,
  FONT_DISPLAY,
  FS,
  FW,
  LH,
  RADIUS,
  BORDER,
  PILL_SHADOW,
  TEXT_SHADOW,
  GLASS,
  springIn,
  accentOf,
} from "../theme";
import { Icon } from "../Icon";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useAnnotation } from "../annotation";
import { Annotated, chunkText, circlePer, CIRCLED_TEXT_WIDTH_LANDSCAPE } from "../PageHeading";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const TitleScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const subPoints = page.points || [];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  /*
   * 手绘标注在封面页上一直是静默失效的：封面自己画标题，不走 HeadingContent，
   * 而 AnnotationContext 对所有页都会提供（PageBody）——接上就行。
   * 注意下面那条手绘下划线：已经有标注时它就是装饰本身，
   * 不再叠第二条（否则 underline 会画出两条下划线，和 HeadingContent 里踩过的坑一样）。
   */
  const rawAnnot = useAnnotation();
  const annotate = rawAnnot && rawAnnot !== "none" ? rawAnnot : null;
  const timing = useSceneTiming();
  const t0 = timing.frameAt(0);
  const o = springIn(f, fps, t0, page.motion);
  const s = interpolate(f, [t0, t0 + 26], [0.86, 1], { extrapolateRight: "clamp", output: "perceptual-scale" });

  const titleChars = Array.from(title).length;
  /*
   * 竖屏字号：不再按字数分三档猜，而是**先算一行能放多大**，放得下就不折行。
   *
   * 分档那套的老问题：76/56/44 是按横屏字数划的，竖屏画布窄，15~16 字正好卡在
   * "56 能一行、再大一档就折两行"的边界。实测 16 字标题
   * （周报没人看，是因为你写成了流水账）在 62px 下折成
   * 「周报没人看，是因 / 为你写成了流水账」——把"因为"劈开，中文没有词边界，
   * `text-wrap: balance` 也救不了这种断法。
   *
   * 现在：可用宽 960px（div 限宽 92% = 994，留 34px 余量）、扣掉 1px 字间距，
   * 算出单行最大字号，封顶 92（10 字 = 929px）。算下来 ≤16 字都能一行放下；
   * 再长就维持 59px 折行（59 比原来的 44 大一档，25 字从 3 行变 2 行）。
   */
  const fitOne = Math.floor((960 - (titleChars - 1)) / Math.max(1, titleChars));
  const titleFontSize = isPortrait
    ? Math.max(59, Math.min(92, fitOne))
    : titleChars > 18
      ? 64
      : titleChars > 14
        ? 72
        : 88;
  /*
   * 下划线宽度要跟真实字号走。
   * 原来用写死的 88px 乘字数，但 >14 字时字号已降到 56/72，
   * 算出来的宽度偏大 28%~40%：9 字标题实际 414px，下划线却画 615px。
   */
  const titleVisualWidth = Math.min(
    isPortrait ? contentWidth * 0.94 : 1680,
    Math.max(300, titleChars * titleFontSize * 1.04),
  );
  // 下划线跟正文等宽：写死的 680 封顶会让 9 字标题（实测 795px）的
  // 下划线只有 672px，短一截。
  const underlineW = Math.min(isPortrait ? contentWidth * 0.94 : 1700, Math.max(220, titleVisualWidth * 0.97));
  const titleLineHeight = LH.tight;

  const typedChars = Math.floor(
    interpolate(f, [t0, t0 + 40], [0, titleChars], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  /*
   * circle 标注要自己断行：rough-notation 的容器是 white-space:pre，永远不折行，
   * 而手绘椭圆宽 = （文字宽 + 60）× √2。断行位按**整句**算（circlePer），
   * 打字动画每帧只拿已出的那几个字去切，不会跳行。
   */
  const perLine =
    annotate === "circle" ? circlePer(title, titleFontSize, isPortrait ? undefined : CIRCLED_TEXT_WIDTH_LANDSCAPE) : 0;
  const shapedTyped = chunkText(title.slice(0, typedChars), perLine);
  const caretOpacity = interpolate(f % 16, [0, 8, 16], [1, 0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingBottom: captionReserve }}
    >
      <div
        style={{
          opacity: o,
          transform: `scale(${s})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        {page.effects?.threeD ? (
          <div style={{ perspective: 1000, width: "100%", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                fontSize: titleFontSize,
                fontWeight: FW.heavy,
                textAlign: "center",
                maxWidth: "92%",
                fontFamily: FONT_DISPLAY,
                lineHeight: titleLineHeight,
                textWrap: "balance",
                letterSpacing: 1,
                color: C.ink,
                textShadow: TEXT_SHADOW,
                transform: `rotateX(${interpolate(s, [0, 1], [28, 0])}deg) translateZ(${interpolate(s, [0, 1], [-40, 0])}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              {title}
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: titleFontSize,
              fontWeight: FW.heavy,
              textAlign: "center",
              maxWidth: "92%",
              fontFamily: FONT_DISPLAY,
              lineHeight: titleLineHeight,
              textWrap: "balance",
              letterSpacing: 1,
              color: C.ink,
              textShadow: TEXT_SHADOW,
            }}
          >
            {/* 标注只包文字本身，不包标题这个块：块是整行宽，rough-notation 再各加 30px
                内边距，椭圆就比画布还宽、两端被切掉（实测）。包文字时它贴着字走。 */}
            {annotate ? <Annotated kind={annotate}>{shapedTyped}</Annotated> : title.slice(0, typedChars)}
            {/* 光标只在"还在打字"时出现：此前它一直渲染，成片里标题后面永远挂着一个小方块 */}
            {typedChars < title.length ? <span style={{ opacity: caretOpacity, color: C.accent }}>▌</span> : null}
          </div>
        )}
        {annotate ? null : (
          <svg
            width={underlineW}
            height={22}
            viewBox={`0 0 ${underlineW} 22`}
            preserveAspectRatio="none"
            // 6px 贴着字底读起来像删除线，14px 才是下划线的感觉
            style={{ marginTop: isPortrait ? 18 : 14, opacity: o }}
          >
            {page.effects?.pathDraw ? (
              <UnderlinePath w={underlineW} progress={springIn(f, fps, t0 + 10, page.motion)} color={C.accent} />
            ) : (
              <path
                d={`M 6 14 C ${underlineW * 0.22} 4, ${underlineW * 0.6} 22, ${underlineW - 8} 10`}
                fill="none"
                stroke={C.accent}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.85}
              />
            )}
          </svg>
        )}
      </div>
      {subPoints.length > 0 && (
        <div
          style={{
            marginTop: sp(isPortrait ? 68 : 40),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: sp(isPortrait ? 30 : 18),
            width: isPortrait ? contentWidth : 1500,
          }}
        >
          {subPoints.map((p, i) => {
            const text = pointText(p, i);
            if (!text) return null;
            const delay = resolveAnchor(timing, pointAnchor(p), i, 0, 6) + 10;
            const itemO = springIn(f, fps, delay, page.motion);
            const ac = accentOf(i);
            const len = [...text].length;
            // 竖屏要点跟着标题一起放大一档（原来比标题小一大截，封面读起来像注释）
            const base = isPortrait ? fs(FS.body) * 1.1 : FS.heading;
            const fsItem = Math.round(base * (len <= 18 ? 1 : len <= 26 ? 0.92 : 0.84));
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: `${sp(isPortrait ? 20 : 14)}px ${sp(isPortrait ? 40 : 34)}px`,
                  background: GLASS.pill,
                  border: `${BORDER.card}px solid ${alpha(ac, 33)}`,
                  borderRadius: RADIUS.pill,
                  boxShadow: PILL_SHADOW,
                  opacity: itemO,
                  transform: `translateY(${interpolate(itemO, [0, 1], [18, 0])}px)`,
                  maxWidth: isPortrait ? contentWidth : Math.min(1500, contentWidth),
                }}
              >
                <div
                  style={{
                    width: sp(30),
                    height: sp(30),
                    borderRadius: "50%",
                    background: `${alpha(ac, 10)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: sp(14),
                    flexShrink: 0,
                  }}
                >
                  <Icon name={pointIcon(p, i)} size={sp(18)} color={ac} />
                </div>
                <div
                  style={{
                    fontSize: fsItem,
                    color: C.sub,
                    fontFamily: FONT,
                    fontWeight: FW.regular,
                    lineHeight: LH.tight,
                  }}
                >
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

const UnderlinePath: React.FC<{ w: number; progress: number; color: string }> = ({ w, progress, color }) => {
  const d = `M 6 14 C ${w * 0.22} 4, ${w * 0.6} 22, ${w - 8} 10`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeLinecap="round"
      opacity={0.85}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
    />
  );
};
