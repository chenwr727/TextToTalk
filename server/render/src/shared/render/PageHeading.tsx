import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT_DISPLAY, FW, RADIUS, BORDER, PILL_SHADOW, GLASS, ACCENT_GRAD, alpha, useTheme } from "./theme";
import { useResponsive } from "./responsive";
import { useAnnotation, type PageAnnotation } from "./annotation";
import { Circle, Highlight, Underline } from "@remotion/rough-notation";

/**
 * 标题内容本身（胶囊 / 左侧竖线 / 纯文字 + 装饰线），不带定位。
 *
 * 抽出来是为了让图表页也能用同一套标题语言：图表把标题放在垂直居中的内容列里
 * （走正常流），不能像其它版式那样绝对定位在页面顶部，否则会压住图形。
 */
export const HeadingContent: React.FC<{ text: string; inline?: boolean }> = ({ text, inline = false }) => {
  const f = useCurrentFrame();
  const { isPortrait, fs, sp } = useResponsive();
  const t = useTheme();
  const raw = useAnnotation();
  const annotate = raw && raw !== "none" ? raw : null;
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (!text) return null;

  const size = isPortrait ? fs(t.heading.size) : t.heading.size;
  const isPill = t.heading.style === "pill";
  // 图表页的标题落在居中的内容列里，无论主题是否左对齐都居中，否则与图形错位
  const center = inline || t.heading.align === "center";

  const type: CSSProperties = {
    fontSize: size,
    fontWeight: FW.heavy,
    lineHeight: 1.2,
    color: isPill ? C.accent : C.ink,
    fontFamily: FONT_DISPLAY,
    letterSpacing: `${t.heading.letterSpacing}px`,
  };

  const rule =
    t.heading.style === "pill" ? (
      <div
        style={{
          position: "relative",
          width: isPortrait ? sp(120) : 120,
          height: 6,
          borderRadius: RADIUS.pill,
          background: ACCENT_GRAD,
          boxShadow: `0 2px 8px ${C.accentFaint}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -3,
            left: -3,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: t.gradEnd,
            boxShadow: `0 0 8px ${C.accentSoft}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: C.accent,
            boxShadow: `0 0 8px ${C.accentSoft}`,
          }}
        />
      </div>
    ) : (
      <div
        style={{
          width: t.heading.style === "bar" && !inline ? "100%" : isPortrait ? sp(160) : 160,
          height: t.heading.style === "bar" && !inline ? 3 : 2,
          borderRadius: RADIUS.pill,
          background: t.heading.style === "bar" && !inline ? `${ACCENT_GRAD}` : C.accentSoft,
          opacity: 0.9,
        }}
      />
    );

  /*
   * 标题本体单独拿出来，因为手绘标注要包的是「标题」，不是「标题 + 装饰线」。
   * 实测：effects.annotation=underline 时，rough-notation 会把整个列（含装饰线）包起来，
   * 于是装饰线的两颗圆点被手绘拖得与线重叠，远看像一团涂鸦（竖屏实测 580px 宽的双笔曲线 + 2 个孤点）。
   * 所以：有标注时它就是装饰本身，不再叠一条主题装饰线。
   */
  const titleEl = isPill ? (
    <div
      style={{
        ...type,
        padding: `${isPortrait ? sp(16) : 16}px ${isPortrait ? sp(46) : 46}px`,
        background: GLASS.pill,
        border: `${BORDER.card}px solid ${C.accent}`,
        borderRadius: RADIUS.pill,
        boxShadow: PILL_SHADOW,
      }}
    >
      {text}
    </div>
  ) : t.heading.style === "bar" ? (
    <div style={{ display: "flex", alignItems: "center", gap: isPortrait ? sp(18) : 18, maxWidth: "100%" }}>
      <div
        style={{
          width: 8,
          height: size * 1.1,
          borderRadius: 4,
          background: ACCENT_GRAD,
          flexShrink: 0,
        }}
      />
      <div style={{ ...type }}>{text}</div>
    </div>
  ) : (
    <div style={{ ...type }}>{text}</div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        gap: isPortrait ? sp(16) : 16,
        maxWidth: "100%",
        opacity: o,
      }}
    >
      {annotate ? <Annotated kind={annotate}>{titleEl}</Annotated> : titleEl}
      {annotate ? null : rule}
    </div>
  );
};

/**
 * 手绘标注层。
 *
 * progress 由帧驱动（12 帧内画完），没动画的路径留给 rough-notation 自己的抖动种子，
 * seed 固定为标题长度 —— 保证同一页每次渲染的笔迹完全一致。
 */
const Annotated: React.FC<{ kind: Exclude<PageAnnotation, "none">; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const f = useCurrentFrame();
  const progress = interpolate(f, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seed = 7;
  if (kind === "circle") {
    return (
      <Circle
        progress={progress}
        color={C.accent}
        strokeWidth={4}
        padding={{ top: 18, right: 30, bottom: 18, left: 30 }}
        seed={seed}
      >
        {children}
      </Circle>
    );
  }
  if (kind === "underline") {
    return (
      <Underline progress={progress} color={C.accent} strokeWidth={4} padding={{ top: 6 }} seed={seed}>
        {children}
      </Underline>
    );
  }
  return (
    <Highlight
      progress={progress}
      color={alpha(C.accent, 26)}
      padding={{ top: 6, right: 10, bottom: 6, left: 10 }}
      seed={seed}
    >
      {children}
    </Highlight>
  );
};

/**
 * 标题占位测量。
 *
 * PageHeading 是绝对定位、不占文档流的，于是每个版式各自猜"标题到底有多高"：
 * `HEADER_OFFSET = 250` 一个常数用在五个版式里，实测"标题底 → 内容顶"分别是
 * 49 / 81 / 103 / 213 / 262px —— 有的几乎贴着标题，有的空出一整块。
 * 这里按主题的标题形态（pill / bar / plain）把高度真算出来，内容一律从
 * `contentTop` 起笔，换主题、换竖屏缩放都自动跟随。
 */
export const useHeadingMetrics = () => {
  const { isPortrait, sp, fs } = useResponsive();
  const t = useTheme();
  const size = isPortrait ? fs(t.heading.size) : t.heading.size;
  const top = isPortrait ? sp(90) : 90;
  // 胶囊标题自带上下内边距；bar / plain 的文字就是行高本身
  const pillPad = t.heading.style === "pill" ? (isPortrait ? sp(16) : 16) * 2 : 0;
  const ruleH = t.heading.style === "pill" ? 6 : 2;
  const gapToRule = isPortrait ? sp(16) : 16;
  const height = pillPad + size * 1.2 + gapToRule + ruleH;
  const gap = isPortrait ? sp(48) : 48;
  return { top, height, bottom: top + height, contentTop: top + height + gap };
};

/**
 * 页面标题（页面级，绝对定位在顶部）。
 *
 * 标题形态是主题的一部分：pill（胶囊）/ bar（左侧竖线）/ plain（纯文字 + 细下划线），
 * 三种形态的对齐、字号、字距也由主题给，所以换主题时这里是最明显的差异点之一。
 */
export const PageHeading: React.FC<{ text: string }> = ({ text }) => {
  const { isPortrait, sp } = useResponsive();
  const t = useTheme();
  const center = t.heading.align === "center";

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: isPortrait ? sp(90) : 90,
        left: center ? 0 : isPortrait ? sp(64) : 120,
        right: center ? 0 : isPortrait ? sp(64) : 120,
        display: "flex",
        justifyContent: center ? "center" : "flex-start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "100%" }}>
        <HeadingContent text={text} />
      </div>
    </div>
  );
};
