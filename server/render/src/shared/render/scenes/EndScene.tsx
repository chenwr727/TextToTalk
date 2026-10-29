import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FS, FW, RADIUS, CARD_SHADOW, DOT_SHADOW, TEXT_SHADOW, springIn } from "../theme";
import { pointText } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";

export const EndScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points || [];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const t0 = timing.frameAt(0);
  const o = springIn(f, fps, t0 + 8, page.motion);
  const check = springIn(f, fps, t0, page.motion);
  /*
   * 竖屏收尾页整体放大一档。
   *
   * 竖屏这一页只有「圆章 + 标题 + 三条要点」，原来按横屏尺寸居中摆放，实测正文只占
   * y 704..1201 —— 498px，等于**画面 34%**，上下各空 700px，像一页没加载完的封面。
   * 竖屏有 1480px 的可画高度，这个内容量就该撑到 50%+：圆章 90→124、标题再放 15%、
   * 要点增高加间距。要点条数多（>4 条）时不放大，避免溢出。
   */
  const roomy = isPortrait && points.length <= 4;
  const markSize = roomy ? sp(152) : sp(90);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div
        style={{
          marginBottom: roomy ? sp(46) : sp(34),
          width: markSize,
          height: markSize,
          borderRadius: "50%",
          background: C.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: CARD_SHADOW,
          transform: `scale(${interpolate(check, [0, 1], [0.4, 1], { output: "perceptual-scale" })})`,
          opacity: check,
        }}
      >
        <span style={{ color: "#fff", fontSize: isPortrait ? fs(FS.title) : FS.title, fontWeight: FW.heavy }}>✓</span>
      </div>
      <div
        style={{
          /*
           * 收尾页标题加"按长度分档 + 限宽折行"。
           * 原来只有 88px 一档、不限宽：竖屏 16 字实测 1002px 宽，左右只剩 40px 边距，
           * 再长一点就直接顶到画布边缘。现在限宽 0.86 画布宽、超 12 字降一档、
           * 超 20 字再降一档，并用 balance 均分两行。
           */
          maxWidth: isPortrait ? contentWidth * 0.86 : 1560,
          fontSize: (() => {
            const base = isPortrait ? fs(FS.display - 8) : FS.display - 8;
            const chars = Array.from(title).length;
            const k = chars > 20 ? 0.68 : chars > 12 ? 0.82 : 1;
            return Math.round(base * k * (roomy ? 1.22 : 1));
          })(),
          fontWeight: FW.heavy,
          color: C.ink,
          fontFamily: FONT,
          textAlign: "center",
          textWrap: "balance",
          opacity: o,
          textShadow: TEXT_SHADOW,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: roomy ? sp(22) : sp(26),
          rowGap: roomy ? sp(34) : sp(20),
          marginTop: roomy ? sp(64) : sp(44),
          maxWidth: isPortrait ? contentWidth : 1680,
          fontSize: isPortrait ? fs(FS.body) : FS.body,
          color: C.sub,
          fontFamily: FONT,
        }}
      >
        {points.map((p, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              background: alpha(C.accent, 10),
              color: C.ink,
              padding: `${roomy ? sp(26) : sp(10)}px ${roomy ? sp(32) : sp(22)}px`,
              borderRadius: RADIUS.pill,
              boxShadow: DOT_SHADOW,
            }}
          >
            {pointText(p, i)}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
