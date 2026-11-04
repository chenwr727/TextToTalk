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
  const markH = isPortrait ? Math.round((isPortrait ? fs(Math.round(FS.hero * 1.12)) : FS.hero) * 1.45 * 0.95) : 150;
  const authorH = author ? sp(72) : 0;
  const baseFs = isPortrait ? fs(Math.round(FS.hero * 1.12)) : FS.hero;
  /*
   * 按**标点**切块，只在标点处断行。
   *
   * 起因：浏览器默认可以在任意两个汉字之间断行，`textWrap: balance` 更会把行拉匀，
   * 实测断成「流程的价值不 / 在管住人，」「砍层级会不 / 会失控？」——
   * 把"不在""不会""不透明"这类词劈开了。CJK 没有空格，CSS 也关不掉这种断法，
   * 只能自己按标点分块、再把块排进行里。
   */
  const chunks = (() => {
    const parts = quote.split(/(?<=[，。；：、！？,.;:!?])/u).filter((s) => s.trim());
    return parts.length ? parts : [quote];
  })();
  const chunkLens = chunks.map((c) => Array.from(c).length);
  /** 每行容量 perLine 时，把块贪心排进行；超长块（单块就超过一行）才硬拆 */
  const packLines = (perLine: number): { lines: string[]; hardSplit: boolean } => {
    const lines: string[] = [];
    let cur = "";
    let hardSplit = false;
    for (const ch of chunks) {
      const cLen = Array.from(ch).length;
      if (cLen > perLine) {
        hardSplit = true;
        if (cur) {
          lines.push(cur);
          cur = "";
        }
        const cs = Array.from(ch);
        for (let i = 0; i < cs.length; i += perLine) lines.push(cs.slice(i, i + perLine).join(""));
        continue;
      }
      if (Array.from(cur + ch).length <= perLine) cur += ch;
      else {
        if (cur) lines.push(cur);
        cur = ch;
      }
    }
    if (cur) lines.push(cur);
    return { lines, hardSplit };
  };
  const { fitFs, lines } = (() => {
    const textW = maxW - sp(60); // 扣掉容器的左右 padding（实测 895 → 835）
    const widest = Math.max(...chunkLens);
    const avail = bandH * 0.86 - markH - authorH - sp(58);
    const cap = Math.round(baseFs * (isPortrait ? 1.7 : 1));
    /*
     * 第一优先：所有标点块都放得下（不许硬拆）——宁可字号小一点，也不在词中断。
     *
     * 实测这条取舍的分量：这条 20 字引文（一个逗号）在 1080 宽下，
     * "不许硬拆"要求每行容得下 10 字 → 字号上限约 82px → 2 行、fill 约 32%；
     * 而允许硬拆能到 124px、4 行、fill 58%。两行大字比四行碎字像金句页，选前者。
     */
    for (let cand = cap; cand > 0; cand -= 2) {
      const perLine = Math.floor(textW / (cand * 1.02));
      if (perLine < widest) continue;
      const packed = packLines(perLine);
      if (packed.hardSplit) continue;
      if (packed.lines.length * cand * LH.body <= avail) return { fitFs: cand, lines: packed.lines };
    }
    // 退而求其次：允许硬拆（长句没有标点时的唯一出路）
    for (let cand = cap; cand > 0; cand -= 2) {
      const perLine = Math.floor(textW / (cand * 1.02));
      if (perLine < 4) continue;
      const packed = packLines(perLine);
      if (packed.lines.length * cand * LH.body <= avail) return { fitFs: cand, lines: packed.lines };
    }
    return { fitFs: baseFs, lines: packLines(Math.max(4, Math.floor(textW / (baseFs * 1.02)))).lines };
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
        {/*
         * 逐行渲染（由 `packLines` 在标点处断开），不再交给浏览器折行：
         * 浏览器会在任意两个汉字之间断，把词劈开。
         */}
        {lines.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
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
