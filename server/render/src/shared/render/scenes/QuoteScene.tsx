import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, FW, LH, RADIUS, BORDER, PILL_SHADOW, TEXT_SHADOW, GLASS, springIn } from "../theme";
import { pointText } from "../point";
import { useCaptionReserve, useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import type { SceneProps } from "./types";

export const QuoteScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps, height: canvasH } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionReserve = useCaptionReserve(
    subtitles,
    page.sentences && page.sentences.length ? page.sentences.map((x) => x.text) : (page.captions ?? []),
  );
  const timing = useSceneTiming();
  const o = springIn(f, fps, timing.frameAt(0), page.motion);
  const quote = items[0] ? pointText(items[0], 0) : title;
  const author = items[1] ? pointText(items[1], 1) : "";
  /*
   * 竖屏的引用要「长大」。
   *
   * 原来两个方向共用一个字号（竖屏 fs(FS.hero×1.12)）并居中，
   * 实测正文 682..1225 只占带的 35%：9:16 画布上一句小字漂在中间。
   * 引用页只有一句话，字小了就没有“金句”的分量；这里按带高反推字号，
   * 让整块（引号 + 引文 + 出处）占到带的约 78%，且从标题下面起笔。
   */
  const bandH = Math.max(320, canvasH - contentTop - Math.max(captionReserve, sp(120)));
  const maxW = isPortrait ? contentWidth * 0.94 : 1240;
  const chars = Math.max(1, Array.from(quote).length);
  const markH = isPortrait ? Math.round((isPortrait ? fs(Math.round(FS.hero * 1.12)) : FS.hero) * 1.45 * 0.95) : 150;
  const authorH = author ? sp(72) : 0;
  const baseFs = isPortrait ? fs(Math.round(FS.hero * 1.12)) : FS.hero;
  const fitFs = (() => {
    if (!isPortrait) return baseFs;
    const avail = bandH * 0.78 - markH - authorH - sp(58);
    /* 从大往小试：先满足行高，再保证每行至少 5 字（字太大会成为一行两字的怪物） */
    /* 上限 1.45×：再大就是“一行五字的海报”，不像解说视频的金句页（实测 2× 时折成 5 行、
     * 每行 5 字，海报感过头）；且每行至少 8 字，保证读起来是句子而不是字碑 */
    const cap = Math.round(baseFs * 1.45);
    for (let cand = cap; cand > baseFs; cand -= 2) {
      const perLine = Math.max(8, Math.floor(maxW / (cand * 1.02)));
      const lines = Math.ceil(chars / perLine);
      if (lines * cand * LH.body <= avail) return cand;
    }
    return baseFs;
  })();
  return (
    <AbsoluteFill
      style={{
        /*
         * 两个方向都居中。
         *
         * 引用页只有一句话 + 出处，它是「一个整体」而不是一列卡片：
         * 试过贴标题起笔（5b6f90 → 「标题下空 29px、带底空 562px」），
         * 上重下轻比居中难看得多。字号仍按带高反推放大，所以不会再是“一句小字漂在中间”。
         */
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        // 标题在 top:90（绝对定位），字幕条在 925左右：两边都留出位置，正文在中间坐落
        paddingTop: isPortrait ? contentTop : 210,
        paddingBottom: isPortrait ? Math.max(captionReserve, sp(120)) : 190,
      }}
    >
      {/*
       * 补上页级标题。
       *
       * 其余 8 个 points 版式的标题都在 y90~190，只有 quote 页没有 `PageHeading`：
       * 整页第一笔墨迹是 y280 的那个大引号，标题区 328px 全空 —— 切到这一页时
       * 观众会以为漏了标题，节奏也断掉。
       */}
      <PageHeading text={title} />
      {/*
       * 引号跟着正文走，不再钉在画布的固定高度上。
       *
       * 它曾经是正常流里的 220px 字符 + marginBottom：Georgia 的弯引号带基线偏移，
       * 实际占掉约 300px，把正文整块顶下去。于是改成 `position:absolute; top:sp(330)`。
       * 但正文是居中的：引号钉在绝对 y≈280，正文却在 y≈900 —— 中间 620px 空白，
       * 成片里看起来就是一个孤零零的引号悬在半空中（实测帧 t=26s）。
       * 现在用一个定高的 flex 容器把它放回流里：高度固定就能吸掉基线偏移，
       * 引号与正文永远相邻，整块一起居中。
       */}
      <div
        style={{
          height: isPortrait ? Math.round(fitFs * 0.95) : 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${interpolate(o, [0, 1], [0.6, 1], { output: "perceptual-scale" })})`,
          opacity: o * 0.9,
        }}
      >
        <span
          style={{
            color: C.accent,
            fontSize: isPortrait ? Math.round(fitFs * 1.35) : 260,
            fontWeight: FW.black,
            fontFamily: "Georgia, serif",
            lineHeight: 0.8,
            textShadow: TEXT_SHADOW,
            pointerEvents: "none",
          }}
        >
          “
        </span>
      </div>
      <div
        style={{
          maxWidth: isPortrait ? contentWidth * 0.94 : 1240,
          opacity: o,
          fontSize: fitFs,
          fontWeight: FW.heavy,
          color: C.ink,
          textAlign: "center",
          lineHeight: LH.body,
          fontFamily: FONT,
          // 按标点/词边界折行：原来的 "…而在让 / 人少等一会儿" 把词语劈开了
          textWrap: "balance",
          padding: `${sp(10)}px ${sp(30)}px`,
          textShadow: TEXT_SHADOW,
        }}
      >
        {quote}
      </div>
      {author && (
        <div
          style={{
            marginTop: sp(48),
            opacity: o,
            padding: `${sp(12)}px ${sp(34)}px`,
            background: GLASS.pill,
            border: `${BORDER.card}px solid ${C.accent}`,
            borderRadius: RADIUS.pill,
            fontSize: isPortrait ? fs(FS.body) : FS.body,
            fontWeight: FW.bold,
            color: C.sub,
            fontFamily: FONT,
            boxShadow: PILL_SHADOW,
          }}
        >
          —— {author}
        </div>
      )}
    </AbsoluteFill>
  );
};
