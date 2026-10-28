import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, FW, LH, RADIUS, BORDER, PILL_SHADOW, TEXT_SHADOW, GLASS, springIn } from "../theme";
import { pointText } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import { PageHeading } from "../PageHeading";
import type { SceneProps } from "./types";

export const QuoteScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const o = springIn(f, fps, timing.frameAt(0), page.motion);
  const quote = items[0] ? pointText(items[0], 0) : title;
  const author = items[1] ? pointText(items[1], 1) : "";
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        // 标题在 top:90（绝对定位），字幕条在 925左右：两边都留出位置，正文在中间坐落
        paddingTop: isPortrait ? sp(520) : 210,
        paddingBottom: isPortrait ? sp(300) : 190,
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
      <div
        style={{
          /*
           * 引号改成装饰元素：绝对定位在正文上方。
           *
           * 原来它是个正常流里的 220px 字符 + `marginBottom`，Georgia 的弯引号带基线偏移，
           * 实际占掉约 300px，把正文整块顶下去，页面上方留 328px 白、下方再留一大片。
           */
          position: "absolute",
          top: isPortrait ? sp(330) : 250,
          left: "50%",
          transform: `translateX(-50%) scale(${interpolate(o, [0, 1], [0.6, 1], { output: "perceptual-scale" })})`,
          opacity: o * 0.9,
          color: C.accent,
          fontSize: isPortrait ? fs(260) : 260,
          fontWeight: FW.black,
          fontFamily: "Georgia, serif",
          lineHeight: 0.8,
          textShadow: TEXT_SHADOW,
          pointerEvents: "none",
        }}
      >
        “
      </div>
      <div
        style={{
          maxWidth: isPortrait ? contentWidth * 0.94 : 1240,
          opacity: o,
          fontSize: isPortrait ? fs(FS.hero) : FS.hero,
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
