import { createContext, useContext, type CSSProperties } from "react";
import { spring } from "remotion";
import { fitText, measureText } from "@remotion/layout-utils";

/* ------------------------------------------------------------------ *
 * 字体
 * ------------------------------------------------------------------ */

/** 真实字体栈：测量文字宽度时必须是真值，CSS 变量在这里无效 */
export const FONT_STACK = "'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

/** 用于样式的字体值：读主题注入的 CSS 变量，因此主题一换、全站字体跟着换 */
export const FONT = "var(--ttt-font)";

/**
 * 标题/大字专用字体：优先思源黑体 + Sora（由 server/scripts/fetch-fonts.mjs 下载到 public/fonts）。
 * 字体文件缺失时浏览器会顺着栈往下回退，行为与改造前一致。
 */
export const FONT_DISPLAY_STACK = "'TTT Display', 'TTT CJK', " + FONT_STACK;
export const FONT_DISPLAY = "var(--ttt-font-display)";

export const fitFontSize = (
  text: string,
  withinWidth: number,
  min = 24,
  max = 56,
  fontWeight: number | string = 700,
  fontFamily: string = FONT_STACK,
) => {
  try {
    const { fontSize } = fitText({ text, withinWidth, fontFamily, fontWeight });
    return Math.max(min, Math.min(max, fontSize));
  } catch {
    return max;
  }
};

export const fitFontSizeBox = (
  text: string,
  withinWidth: number,
  withinHeight: number,
  min = 24,
  max = 56,
  fontWeight: number | string = 700,
  lineHeight = 1.5,
) => {
  const chars = [...text];
  for (let fs = max; fs >= min; fs -= 2) {
    const charW = measureTextWidth("中", fs, fontWeight);
    const perLine = Math.max(1, Math.floor(withinWidth / charW));
    const lines = Math.ceil(chars.length / perLine);
    if (lines * fs * lineHeight <= withinHeight) return fs;
  }
  return min;
};

export const measureTextWidth = (
  text: string,
  fontSize: number,
  fontWeight: number | string = 700,
  fontFamily: string = FONT_STACK,
): number => {
  try {
    const { width } = measureText({ text, fontFamily, fontSize, fontWeight });
    return width;
  } catch {
    const bold = Number(fontWeight) >= 700;
    return (
      [...text].reduce((acc, ch) => acc + (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.6), 0) *
      fontSize *
      (bold ? 1.1 : 1)
    );
  }
};

/* ------------------------------------------------------------------ *
 * 主题 token
 * ------------------------------------------------------------------ */

export type ThemeId = "tech" | "business" | "fresh" | "warm" | "dark";

export type BgVariantMap = Record<string, { grad: string; orb: string; orbColor: string }>;

export interface ThemeTokens {
  label: string;
  /** 深色主题：文字色/卡面是反的，Bg 也要走暗色分支 */
  dark: boolean;
  font: string;
  /** 标题专用字体栈；不填则用 FONT_DISPLAY_STACK（思源黑体 + Sora） */
  displayFont?: string;
  ink: string;
  sub: string;
  muted: string;
  /** 主强调色（按钮、标题线、图表首色） */
  accent: string;
  /** 6 色强调序列，按序号分配语义之外的装饰色 */
  accents: [string, string, string, string, string, string];
  /** 强调渐变的第二个色（ACCENT_GRAD 用） */
  gradEnd: string;
  card: {
    bg: string;
    border: string;
    shadow: string;
    radius: number;
    radiusBox: number;
  };
  pill: { bg: string; shadow: string };
  /** 标题呈现方式：胶囊底 / 左侧竖线 / 纯文字 */
  heading: {
    style: "pill" | "bar" | "plain";
    align: "left" | "center";
    size: number;
    letterSpacing: number;
  };
  decor: { ring: string; ringAccent: string; grid: string; glow: string };
  bg: BgVariantMap;
}

/** 主色 / 装饰色的半透明档位。引用 var(--ttt-accent)，页面级主色一改就整体跟随 */
const tint = (pct: number) => `color-mix(in srgb, var(--ttt-accent) ${pct}%, transparent)`;

const baseOrb = "520px";

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  tech: {
    label: "科技蓝",
    dark: false,
    font: FONT_STACK,
    ink: "#1c2536",
    sub: "#5a6b82",
    muted: "#8a99b0",
    accent: "#3b6ff5",
    accents: ["#3b6ff5", "#2fc6a1", "#f2a93b", "#e8659f", "#8b5cf6", "#0ea5e9"],
    gradEnd: "#2fc6a1",
    card: {
      bg: "rgba(255,255,255,0.92)",
      border: "rgba(255,255,255,0.65)",
      shadow: "0 1px 2px rgba(28,37,54,0.06), 0 8px 24px rgba(28,37,54,0.10), 0 24px 48px -12px rgba(28,37,54,0.16)",
      radius: 24,
      radiusBox: 18,
    },
    pill: {
      bg: "rgba(255,255,255,0.82)",
      shadow: "0 2px 4px rgba(28,37,54,0.06), 0 8px 20px rgba(28,37,54,0.10)",
    },
    heading: { style: "pill", align: "center", size: 48, letterSpacing: 0 },
    decor: {
      ring: "rgba(255,255,255,0.55)",
      ringAccent: tint(10),
      grid: "rgba(28,37,54,0.035)",
      glow: tint(18),
    },
    bg: {
      title: { grad: "linear-gradient(150deg,#eef3ff 0%,#dbe7ff 55%,#cdddff 100%)", orb: baseOrb, orbColor: "#bcd2ff" },
      section: {
        grad: "linear-gradient(150deg,#eef7ff 0%,#ddeeff 45%,#cfe8ff 100%)",
        orb: "560px",
        orbColor: "#b9defc",
      },
      chart: { grad: "linear-gradient(150deg,#f4f8ff 0%,#e9f3ff 50%,#ddeeff 100%)", orb: baseOrb, orbColor: "#c5dcff" },
      art: { grad: "linear-gradient(160deg,#f2f7ff 0%,#e7f1ff 45%,#dcebff 100%)", orb: baseOrb, orbColor: "#bfd8ff" },
      end: { grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)", orb: baseOrb, orbColor: "#cfe3ff" },
      default: {
        grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)",
        orb: baseOrb,
        orbColor: "#cfe3ff",
      },
    },
  },

  business: {
    label: "商务蓝",
    dark: false,
    font: FONT_STACK,
    ink: "#16203a",
    sub: "#4d5a72",
    muted: "#7d8798",
    accent: "#1f4fa8",
    accents: ["#1f4fa8", "#2b7a78", "#9a7b3f", "#8a5a8f", "#4a6fa5", "#5b7c99"],
    gradEnd: "#2b7a78",
    card: {
      bg: "rgba(255,255,255,0.96)",
      border: tint(14),
      shadow: "0 1px 2px rgba(16,26,48,0.06), 0 6px 18px rgba(16,26,48,0.08), 0 18px 40px -12px rgba(16,26,48,0.14)",
      radius: 10,
      radiusBox: 8,
    },
    pill: {
      bg: "rgba(255,255,255,0.9)",
      shadow: "0 1px 3px rgba(16,26,48,0.08), 0 6px 16px rgba(16,26,48,0.08)",
    },
    heading: { style: "bar", align: "left", size: 44, letterSpacing: 0.5 },
    decor: {
      ring: "rgba(255,255,255,0.5)",
      ringAccent: tint(9),
      grid: "rgba(16,26,48,0.05)",
      glow: tint(14),
    },
    bg: {
      title: { grad: "linear-gradient(150deg,#eef2f8 0%,#dbe4f0 55%,#c9d6e8 100%)", orb: baseOrb, orbColor: "#b8c8e0" },
      section: {
        grad: "linear-gradient(150deg,#eef4f9 0%,#dde8f2 45%,#cfe0ee 100%)",
        orb: "560px",
        orbColor: "#b6cbe2",
      },
      chart: { grad: "linear-gradient(150deg,#f2f6fa 0%,#e6eef6 50%,#d9e6f2 100%)", orb: baseOrb, orbColor: "#c2d2e6" },
      art: { grad: "linear-gradient(160deg,#f0f5fa 0%,#e3edf5 45%,#d6e4f0 100%)", orb: baseOrb, orbColor: "#bccfe4" },
      end: { grad: "linear-gradient(150deg,#f4f7fb 0%,#ecf2f8 45%,#e4edf5 100%)", orb: baseOrb, orbColor: "#cbd9ea" },
      default: {
        grad: "linear-gradient(150deg,#f4f7fb 0%,#ecf2f8 45%,#e4edf5 100%)",
        orb: baseOrb,
        orbColor: "#cbd9ea",
      },
    },
  },

  fresh: {
    label: "清新绿",
    dark: false,
    // 幼圆/圆体优先，字形更软，和科技蓝的黑体一眼能看出区别
    font: "'YouYuan', 'Yuanti SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    ink: "#16302a",
    sub: "#43685c",
    muted: "#7d9a90",
    accent: "#22a06b",
    accents: ["#22a06b", "#3fb98a", "#f0b429", "#e86a8f", "#59a5d8", "#7bc96f"],
    gradEnd: "#59c9a5",
    card: {
      bg: "rgba(255,255,255,0.9)",
      border: tint(16),
      shadow:
        "0 2px 6px rgba(22,110,80,0.06), 0 10px 26px rgba(22,110,80,0.10), 0 28px 56px -16px rgba(22,110,80,0.14)",
      radius: 34,
      radiusBox: 26,
    },
    pill: {
      bg: "rgba(255,255,255,0.85)",
      shadow: "0 2px 6px rgba(22,110,80,0.08), 0 10px 24px rgba(22,110,80,0.10)",
    },
    heading: { style: "pill", align: "center", size: 48, letterSpacing: 1 },
    decor: {
      ring: "rgba(255,255,255,0.6)",
      ringAccent: tint(10),
      grid: "rgba(22,110,80,0.035)",
      glow: tint(16),
    },
    bg: {
      title: { grad: "linear-gradient(150deg,#eefaf3 0%,#d9f2e4 55%,#c8ecda 100%)", orb: baseOrb, orbColor: "#b8e6cd" },
      section: {
        grad: "linear-gradient(150deg,#eefaf5 0%,#ddf2e8 45%,#cdeee0 100%)",
        orb: "560px",
        orbColor: "#b3e3c9",
      },
      chart: { grad: "linear-gradient(150deg,#f2fbf6 0%,#e6f6ec 50%,#d9f2e4 100%)", orb: baseOrb, orbColor: "#c0e8d2" },
      art: { grad: "linear-gradient(160deg,#f0faf4 0%,#e4f5ea 45%,#d8f1e2 100%)", orb: baseOrb, orbColor: "#bae6cc" },
      end: { grad: "linear-gradient(150deg,#f4fbf7 0%,#ecf8f0 45%,#e4f5ea 100%)", orb: baseOrb, orbColor: "#c8ecd8" },
      default: {
        grad: "linear-gradient(150deg,#f4fbf7 0%,#ecf8f0 45%,#e4f5ea 100%)",
        orb: baseOrb,
        orbColor: "#c8ecd8",
      },
    },
  },

  warm: {
    label: "暖橙",
    dark: false,
    // 宋体/思源宋体：编辑感的衬线主题，和默认黑体形成强的排版差异
    font: "'Songti SC', 'SimSun', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
    // 衬线主题的标题必须继续走宋体，不能被默认的黑体 display 字体劫持
    displayFont: "'Songti SC', 'SimSun', 'Noto Serif CJK SC', serif",
    ink: "#33231a",
    sub: "#6f5645",
    muted: "#9a8577",
    accent: "#c2571b",
    accents: ["#c2571b", "#a8763e", "#d99a2b", "#c04a5e", "#8e6b9e", "#4f8a8b"],
    gradEnd: "#d99a2b",
    card: {
      bg: "rgba(255,252,247,0.95)",
      border: tint(16),
      shadow: "0 1px 2px rgba(90,50,20,0.06), 0 8px 20px rgba(90,50,20,0.10), 0 22px 44px -12px rgba(90,50,20,0.16)",
      radius: 6,
      radiusBox: 5,
    },
    pill: {
      bg: "rgba(255,252,247,0.88)",
      shadow: "0 2px 4px rgba(90,50,20,0.07), 0 8px 18px rgba(90,50,20,0.10)",
    },
    heading: { style: "plain", align: "left", size: 46, letterSpacing: 0 },
    decor: {
      ring: "rgba(255,255,255,0.5)",
      ringAccent: tint(10),
      grid: "rgba(90,50,20,0.04)",
      glow: tint(16),
    },
    bg: {
      title: { grad: "linear-gradient(150deg,#fff6ee 0%,#ffe9d8 55%,#ffddc6 100%)", orb: baseOrb, orbColor: "#ffd0b0" },
      section: {
        grad: "linear-gradient(150deg,#fff7f0 0%,#ffecdd 45%,#ffe3cf 100%)",
        orb: "560px",
        orbColor: "#ffd2b4",
      },
      chart: { grad: "linear-gradient(150deg,#fffaf4 0%,#fff0e4 50%,#ffe6d4 100%)", orb: baseOrb, orbColor: "#ffd8bd" },
      art: { grad: "linear-gradient(160deg,#fff8f1 0%,#ffede0 45%,#ffe3d2 100%)", orb: baseOrb, orbColor: "#ffd4b8" },
      end: { grad: "linear-gradient(150deg,#fffbf7 0%,#fff3ea 45%,#ffecdf 100%)", orb: baseOrb, orbColor: "#ffdcc6" },
      default: {
        grad: "linear-gradient(150deg,#fffbf7 0%,#fff3ea 45%,#ffecdf 100%)",
        orb: baseOrb,
        orbColor: "#ffdcc6",
      },
    },
  },

  dark: {
    label: "深空",
    dark: true,
    font: FONT_STACK,
    ink: "#eaf0ff",
    sub: "#a8b7d4",
    muted: "#7c8aa6",
    accent: "#6f9bff",
    accents: ["#6f9bff", "#4fd6b0", "#ffc266", "#ff8ab8", "#b18cff", "#5cd3f0"],
    gradEnd: "#4fd6b0",
    card: {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.14)",
      shadow: "0 2px 6px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.45), 0 30px 60px -18px rgba(0,0,0,0.55)",
      radius: 20,
      radiusBox: 16,
    },
    pill: {
      bg: "rgba(255,255,255,0.12)",
      shadow: "0 2px 8px rgba(0,0,0,0.35), 0 10px 26px rgba(0,0,0,0.4)",
    },
    heading: { style: "pill", align: "center", size: 48, letterSpacing: 0 },
    decor: {
      ring: "rgba(255,255,255,0.12)",
      ringAccent: tint(14),
      grid: "rgba(255,255,255,0.05)",
      glow: tint(24),
    },
    bg: {
      title: { grad: "linear-gradient(150deg,#1a2233 0%,#232f47 55%,#2c3a58 100%)", orb: baseOrb, orbColor: "#3a4f7a" },
      section: {
        grad: "linear-gradient(150deg,#1b2436 0%,#24314a 45%,#2e3d5c 100%)",
        orb: "560px",
        orbColor: "#3d5480",
      },
      chart: { grad: "linear-gradient(150deg,#1c2538 0%,#26334d 50%,#30405f 100%)", orb: baseOrb, orbColor: "#405a88" },
      art: { grad: "linear-gradient(160deg,#1b2437 0%,#25324c 45%,#2f3e5d 100%)", orb: baseOrb, orbColor: "#3e5682" },
      end: { grad: "linear-gradient(150deg,#1d2639 0%,#27344e 45%,#31415f 100%)", orb: baseOrb, orbColor: "#425c8a" },
      default: {
        grad: "linear-gradient(150deg,#1d2639 0%,#27344e 45%,#31415f 100%)",
        orb: baseOrb,
        orbColor: "#425c8a",
      },
    },
  },
};

/** 兼容旧导出：theme -> { label, bg } */
export const THEMES = (Object.keys(THEME_TOKENS) as ThemeId[]).reduce(
  (acc, id) => {
    acc[id] = { label: THEME_TOKENS[id].label, bg: THEME_TOKENS[id].bg };
    return acc;
  },
  {} as Record<ThemeId, { label: string; bg: BgVariantMap }>,
);

export const BG_VARIANTS = THEME_TOKENS.tech.bg;

export const DEFAULT_THEME: ThemeId = "tech";

export const THEME_IDS = Object.keys(THEME_TOKENS) as ThemeId[];

export const normalizeThemeId = (id?: string | null): ThemeId =>
  id && Object.prototype.hasOwnProperty.call(THEME_TOKENS, id) ? (id as ThemeId) : DEFAULT_THEME;

/** 主题的结构化信息（标题形态等需要分支判断的地方用它，而不是纯 CSS 变量） */
export const ThemeContext = createContext<ThemeTokens>(THEME_TOKENS[DEFAULT_THEME]);
export const useTheme = (): ThemeTokens => useContext(ThemeContext);

/* ------------------------------------------------------------------ *
 * token -> CSS 变量
 * ------------------------------------------------------------------ */

/**
 * 颜色 + 不透明度。
 *
 * 颜色变量化之后，`${color}cc` 这种拼 hex 后缀的写法会得到 `var(--ttt-a1)cc` 这种非法值
 * （浏览器直接丢弃整条声明，表现为色块/描边莫名消失），必须走 color-mix。
 */
export const alpha = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
/** 主色的半透明档位。用 color-mix 引用 var(--ttt-accent)，页面级主色一改，所有档位自动跟着变 */

/**
 * 页面级主色：把调色板旋转 k 位。
 *
 * 场景里 21 处 accentOf(i) 读的是 --ttt-a{i}，这里把 a0..a5 指向 p(k..k+5)，
 * 于是「这一页用第 k 种主色」不需要改任何场景代码。
 */
export const accentVars = (index?: number | null): CSSProperties | undefined => {
  if (index == null || !Number.isFinite(index)) return undefined;
  const k = ((Math.round(index) % 6) + 6) % 6;
  if (k === 0) return undefined;
  const vars: Record<string, string> = { "--ttt-accent": `var(--ttt-p${k})` };
  for (let i = 0; i < 6; i++) vars[`--ttt-a${i}`] = `var(--ttt-p${(i + k) % 6})`;
  return vars as CSSProperties;
};

/**
 * 把主题铺成 CSS 变量，挂到渲染根节点上。
 * 这样 22 个场景文件里的 C / RADIUS / CARD_SHADOW 等常量不必逐个改成 hook，
 * 只要它们引用 var(--ttt-*)，换主题就整体生效。
 */
export const themeVars = (id?: string | null): CSSProperties => {
  const t = THEME_TOKENS[normalizeThemeId(id)];
  return {
    "--ttt-font": t.font,
    "--ttt-font-display": t.displayFont ?? FONT_DISPLAY_STACK,
    "--ttt-ink": t.ink,
    "--ttt-sub": t.sub,
    "--ttt-muted": t.muted,
    "--ttt-accent": t.accent,
    "--ttt-grad-end": t.gradEnd,
    "--ttt-p0": t.accents[0],
    "--ttt-p1": t.accents[1],
    "--ttt-p2": t.accents[2],
    "--ttt-p3": t.accents[3],
    "--ttt-p4": t.accents[4],
    "--ttt-p5": t.accents[5],
    "--ttt-a0": "var(--ttt-p0)",
    "--ttt-a1": "var(--ttt-p1)",
    "--ttt-a2": "var(--ttt-p2)",
    "--ttt-a3": "var(--ttt-p3)",
    "--ttt-a4": "var(--ttt-p4)",
    "--ttt-a5": "var(--ttt-p5)",
    "--ttt-accent-a88": tint(53),
    "--ttt-accent-a80": tint(80),
    "--ttt-accent-a66": tint(40),
    "--ttt-accent-a55": tint(33),
    "--ttt-accent-a33": tint(20),
    "--ttt-accent-a0d": tint(5),
    "--ttt-grad-accent": "linear-gradient(90deg, var(--ttt-accent), var(--ttt-grad-end))",
    "--ttt-grad-accent-soft":
      "linear-gradient(90deg, color-mix(in srgb, var(--ttt-accent) 80%, transparent), color-mix(in srgb, var(--ttt-grad-end) 80%, transparent))",
    "--ttt-card-bg": t.card.bg,
    "--ttt-card-border": t.card.border,
    "--ttt-card-shadow": t.card.shadow,
    "--ttt-pill-bg": t.pill.bg,
    "--ttt-pill-shadow": t.pill.shadow,
    "--ttt-glass-card": t.card.bg,
    "--ttt-glass-pill": t.pill.bg,
    "--ttt-glass-border": t.card.border,
    "--ttt-shadow-card": t.card.shadow,
    "--ttt-shadow-pill": t.pill.shadow,
    "--ttt-shadow-dot": t.pill.shadow,
    "--ttt-shadow-solid": t.card.shadow,
    "--ttt-shadow-text": t.dark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 6px rgba(28,37,54,0.10)",
    "--ttt-r-card": `${t.card.radius}px`,
    "--ttt-r-card-inner": `${Math.max(0, t.card.radius - 3)}px`,
    "--ttt-r-box": `${t.card.radiusBox}px`,
    "--ttt-r-chip": `${Math.max(0, t.card.radiusBox - 4)}px`,
    "--ttt-r-pill": "999px",
    "--ttt-decor-ring": t.decor.ring,
    "--ttt-decor-ring-accent": t.decor.ringAccent,
    "--ttt-decor-grid": t.decor.grid,
    "--ttt-decor-glow": t.decor.glow,
    "--ttt-heading-size": `${t.heading.size}px`,
    "--ttt-heading-spacing": `${t.heading.letterSpacing}px`,
  } as CSSProperties;
};

/* ------------------------------------------------------------------ *
 * 静态 token（引用 CSS 变量，值由 themeVars 决定）
 * ------------------------------------------------------------------ */

export const C = {
  ink: "var(--ttt-ink)",
  sub: "var(--ttt-sub)",
  accent: "var(--ttt-accent)",
  muted: "var(--ttt-muted)",
  /**
   * 主色的半透明档位。
   * 原来是 `${C.accent}cc` 这种拼 hex 后缀的写法，颜色变量化之后必须改成命名 token，
   * 否则会拼出 "var(--ttt-accent)cc" 这种非法值。
   */
  accentTint: "var(--ttt-accent-a88)",
  accentSoft: "var(--ttt-accent-a80)",
  accentMid: "var(--ttt-accent-a66)",
  accentFaint: "var(--ttt-accent-a55)",
  accentWash: "var(--ttt-accent-a0d)",
};

export const ACCENT_PALETTE = [
  "var(--ttt-a0)",
  "var(--ttt-a1)",
  "var(--ttt-a2)",
  "var(--ttt-a3)",
  "var(--ttt-a4)",
  "var(--ttt-a5)",
];
export const accentOf = (i: number) => ACCENT_PALETTE[Math.abs(i) % ACCENT_PALETTE.length];

export const CARD_SHADOW = "var(--ttt-shadow-card)";
export const PILL_SHADOW = "var(--ttt-shadow-pill)";
export const DOT_SHADOW = "var(--ttt-shadow-dot)";
export const SOLID_SHADOW = "var(--ttt-shadow-solid)";
export const TEXT_SHADOW = "var(--ttt-shadow-text)";

/**
 * 卡片里"小元件"的投影：图标方块、柱子、徽标。
 *
 * 之前这些地方各自写了 `0 2px 8px / 0 2px 10px / 0 8px 20px`，
 * 而卡片的多层大影（CARD_SHADOW）被套在 60px 的实心圆点上，结果发灰。
 */
export const tileShadow = (accent: string) => `0 2px 8px ${alpha(accent, 20)}`;
/** 焦点态：在原卡片影上叠一层主色光晕 */
export const focusShadow = (accent: string) => `0 10px 26px ${alpha(accent, 18)}, ${CARD_SHADOW}`;
/** 光点/标记的辉光 */
export const glowOf = (color: string, pct = 26) => `0 0 10px ${alpha(color, pct)}`;

export const GLASS = {
  card: "var(--ttt-glass-card)",
  pill: "var(--ttt-glass-pill)",
  border: "var(--ttt-glass-border)",
};

export const SAFE = { x: 120, y: 100 };
export const CONTENT_WIDTH = 1920 - SAFE.x * 2;
export const HEADER_OFFSET = 250;

/**
 * 间距比例（4 的倍数）。
 *
 * 之前各场景的 padding/gap 在 8~46 之间几乎每个偶数都用过一遍，
 * 同一语义（卡片内边距）能出现 24/26/28/30/32/34/36 七种取值，换个版式就换一套节奏。
 * 新增视觉一律取这里的档位。
 */
export const SPACE = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64 };

/**
 * 图标方块：卡内小元件的统一尺寸。
 * 此前同一个"图标方块"在 6 个地方写了 44/48/52/56/64/76 六种尺寸、4 种圆角。
 */
export const ICON_TILE = { sm: 44, md: 56, lg: 64 } as const;
/** 方块里图标画多大（约为方块的 0.58） */
export const iconInTile = (size: number) => Math.round(size * 0.58);
export const RADIUS = {
  card: "var(--ttt-r-card)",
  cardInner: "var(--ttt-r-card-inner)",
  box: "var(--ttt-r-box)",
  chip: "var(--ttt-r-chip)",
  pill: "var(--ttt-r-pill)",
};
export const FS = {
  display: 86,
  hero: 96,
  title: 48,
  heading: 40,
  body: 36,
  caption: 30,
  label: 24,
  small: 20,
};
export const BORDER = { card: 2, accent: 3, dashed: 1 };
export const ANIM = { stagger: 20, fade: 22, rise: 40 };

export const LH = {
  tight: 1.2,
  body: 1.5,
  loose: 1.6,
};

export const FW = {
  regular: 600,
  bold: 700,
  heavy: 800,
  black: 900,
};

export const LH_TIGHT = 1;

export const CARD_TYPE = {
  fsCandidates: [34, 31, 28, 25, 22] as const,
  fsMin: 22,
  lineHeight: LH.body,
  maxLines: 4,
  padY: 28,
  padX: 26,
  radius: RADIUS.box,
  iconBox: 48,
  iconSize: 26,
  gapX: 64,
  gapY: 28,
};

/**
 * 从字号阶梯里挑第一个"放得下"的。
 *
 * `candidates` 可覆盖：三卡版式把卡片加宽后，全局阶梯顶格 34 反而偏小，
 * 局部换成更大的阶梯即可，不必动全局（别的版式靠同一阶梯保持节奏）。
 */
export const pickCardFont = (
  maxChars: number,
  textW: number,
  textH?: number,
  candidates: readonly number[] = CARD_TYPE.fsCandidates,
): number => {
  const chosen = candidates.find((fSize) => {
    const perLine = Math.max(1, Math.floor((textW * 0.95) / fSize));
    const lines = Math.ceil(maxChars / perLine);
    if (lines > CARD_TYPE.maxLines) return false;
    if (textH !== undefined && lines * fSize * CARD_TYPE.lineHeight > textH) return false;
    return true;
  });
  return chosen ?? CARD_TYPE.fsMin;
};

/**
 * 把动画进度吸附到"已静止"。
 *
 * 弹簧是渐近收敛的：damping 8 时第 60 帧还差 0.00015，换算成 translateY 是 0.0027px。
 * 这点差值肉眼看不见，却会让浏览器**逐帧重新光栅化文字**（亚像素位置变了），
 * 观感就是文字在轻微晃动。到站就吸附成精确的 1 / 0，后面所有帧的样式才会完全一致。
 */
export const settle = (v: number, eps = 5e-4): number => (v > 1 - eps ? 1 : v < eps ? 0 : v);

/** 位移吸附到整像素（同一原因：文字停在 0.37px 这种位置会一直抖） */
export const snapPx = (v: number): number => Math.round(v);

export const springIn = (frame: number, fps: number, delay = 0, style: "spring" | "linear" | "float" = "spring") => {
  const cfg =
    style === "linear"
      ? { damping: 200, stiffness: 100, mass: 1 }
      : style === "float"
        ? { damping: 15, stiffness: 60, mass: 1.2 }
        : { damping: 8, stiffness: 100, mass: 0.9 };
  return settle(spring({ frame: frame - delay, fps, config: cfg }));
};

export const DECOR = {
  ring: "var(--ttt-decor-ring)",
  ringAccent: "var(--ttt-decor-ring-accent)",
  grid: "var(--ttt-decor-grid)",
  glow: "var(--ttt-decor-glow)",
};

export const ACCENT_GRAD = "var(--ttt-grad-accent)";
export const ACCENT_GRAD_SOFT = "var(--ttt-grad-accent-soft)";

export const PAPER = { base: "22", mid: "33", top: "40", deep: "55" };
