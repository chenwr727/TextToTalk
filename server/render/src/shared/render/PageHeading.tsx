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
 * 导出给「自己画标题」的三个场景用（TitleScene / SectionScene / EndScene）。
 * 这三页不走 HeadingContent，于是 `effects.annotation` 对它们一直是**静默失效**的：
 * 字段在 types/normalize 里都有，AI 也会输出，渲染时却什么都不发生。
 *
 * progress 由帧驱动（12 帧内画完），没动画的路径留给 rough-notation 自己的抖动种子，
 * seed 固定为标题长度 —— 保证同一页每次渲染的笔迹完全一致。
 */
export const Annotated: React.FC<{
  kind: Exclude<PageAnnotation, "none">;
  children: React.ReactNode;
  /**
   * 覆写内边距。封面 / 章节 / 收尾三页的标题有 900px 宽，
   * 默认内边距再叠加手绘椭圆的鼓包会超出 1080 画布。
   */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /**
   * rough-notation 的 circle 默认 box="around"：椭圆宽度 = (文字宽 + 内边距) × 1.414，
   * 实测 915px 宽的封面标题算出 1379px，比 1080 画布还宽，两端被切平。
   * box="inside" 时椭圆就是（文字宽 + 内边距）本身，宽标题用这个。
   */
  box?: "inside" | "around";
}> = ({ kind, children, padding, box }) => {
  const f = useCurrentFrame();
  const progress = interpolate(f, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seed = 7;
  if (kind === "circle") {
    return (
      <Circle
        progress={progress}
        color={C.accent}
        strokeWidth={4}
        padding={{ top: 18, right: 30, bottom: 18, left: 30, ...padding }}
        box={box}
        seed={seed}
      >
        {children}
      </Circle>
    );
  }
  if (kind === "underline") {
    return (
      <Underline progress={progress} color={C.accent} strokeWidth={4} padding={{ top: 6, ...padding }} seed={seed}>
        {children}
      </Underline>
    );
  }
  return (
    <Highlight
      progress={progress}
      color={alpha(C.accent, 26)}
      padding={{ top: 6, right: 10, bottom: 6, left: 10, ...padding }}
      seed={seed}
    >
      {children}
    </Highlight>
  );
};

/**
 * 被 circle 圈住的标题最多能占多宽的字。
 *
 * 手绘椭圆的宽度是 (文字宽 + 内边距) × √2（rough-notation 的 box="around"），
 * 内边距默认左右各 30：要落在 1080 画布内（左右各留 40）字最宽只能是
 * (1000 - 60) / 1.414 ≈ 647。字超过这个宽度就得换行——卡在 640 上面。
 * 直接把 box 改成 "inside" 会得到一个我们试过的坏结果：
 * 椭圆却是落在画布里了，但扁得像一条线，直接从字面中间穿过去。
 */
export const CIRCLED_TEXT_WIDTH = 640;

/**
 * 给 circle 标注的文字插上手动换行。
 *
 * rough-notation 的容器是 `display:inline-block; white-space:pre` —— 文字**永远不折行**，
 * 给它 maxWidth 一点用也没有。而手绘椭圆的宽度是（文字宽 + 内边距）× √2，
 * 封面 10 字号题（929px）算出 1399px，比 1080 画布还宽，两端被切平（实测）。
 * 所以超宽时自己把字断成 2〜3 行：断行位置绑定在**整句**上算，
 * 否则打字动画进行到一半时换行位会跳。
 */
export const circlePer = (text: string, fontSize: number, maxW = CIRCLED_TEXT_WIDTH): number => {
  const chars = Array.from(text);
  const w = chars.length * (fontSize + 1);
  if (w <= maxW) return 0;
  const lines = Math.min(3, Math.ceil(w / maxW));
  let per = Math.ceil(chars.length / lines);
  /*
   * 行首不能是标点。实测：「先定那一行，再写周报」按 5/5 断开后，
   * 第二行以逗号开头（「，再写周报」）。遇到这种情况就把标点并回上一行。
   */
  const PUNCT = "，。、；：！？、）」』】》·,.;:!?)]}";
  if (per > 0 && per < chars.length && PUNCT.includes(chars[per])) per += 1;
  return Math.min(per, chars.length);
};

/** 按固定每行字数扁断文本（字数为 0 时原样返回） */
export const chunkText = (text: string, per: number): string => {
  if (per <= 0) return text;
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += per) out.push(chars.slice(i, i + per).join(""));
  return out.join("\n");
};

/** 一步到位：超宽就断行（静态文本用） */
export const circleWrap = (text: string, fontSize: number, maxW = CIRCLED_TEXT_WIDTH): string =>
  chunkText(text, circlePer(text, fontSize, maxW));

/**
 * 横屏宽度下的同一上限。
 *
 * 椭圆宽 = （文字宽 + 60）× √2；1920 画布容得下约 1300px 的字，
 * 横屏封面标题（88px × 10 字 = 890）因此不需要断行。
 */
export const CIRCLED_TEXT_WIDTH_LANDSCAPE = 1300;

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
