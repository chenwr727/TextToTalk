import { spring } from "remotion";
import { fitText, measureText } from "@remotion/layout-utils";

export const FONT = "'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export const fitFontSize = (text: string, withinWidth: number, min = 24, max = 56, fontWeight: number | string = 700) => {
  try {
    const { fontSize } = fitText({ text, withinWidth, fontFamily: FONT, fontWeight });
    return Math.max(min, Math.min(max, fontSize));
  } catch {
    return max;
  }
};

export const fitFontSizeBox = (text: string, withinWidth: number, withinHeight: number, min = 24, max = 56, fontWeight: number | string = 700, lineHeight = 1.5) => {
  const chars = [...text];
  for (let fs = max; fs >= min; fs -= 2) {
    const charW = measureTextWidth("中", fs, fontWeight);
    const perLine = Math.max(1, Math.floor(withinWidth / charW));
    const lines = Math.ceil(chars.length / perLine);
    if (lines * fs * lineHeight <= withinHeight) return fs;
  }
  return min;
};

export const measureTextWidth = (text: string, fontSize: number, fontWeight: number | string = 700): number => {
  try {
    const { width } = measureText({ text, fontFamily: FONT, fontSize, fontWeight });
    return width;
  } catch {
    const bold = Number(fontWeight) >= 700;
    return [...text].reduce((acc, ch) => acc + (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.6), 0) * fontSize * (bold ? 1.1 : 1);
  }
};

export const C = {
  ink: "#1c2536",
  sub: "#5a6b82",
  accent: "#3b6ff5",
  muted: "#8a99b0",
};

export const ACCENT_PALETTE = ["#3b6ff5", "#2fc6a1", "#f2a93b", "#e8659f", "#8b5cf6", "#0ea5e9"];
export const accentOf = (i: number) => ACCENT_PALETTE[i % ACCENT_PALETTE.length];

const SH = {
  ink1: "rgba(28,37,54,0.06)",
  ink2: "rgba(28,37,54,0.10)",
  ink3: "rgba(28,37,54,0.16)",
};

export const CARD_SHADOW = `0 1px 2px ${SH.ink1}, 0 8px 24px ${SH.ink2}, 0 24px 48px -12px ${SH.ink3}`;
export const PILL_SHADOW = `0 2px 4px ${SH.ink1}, 0 8px 20px ${SH.ink2}`;
export const DOT_SHADOW = `0 2px 6px ${SH.ink2}, 0 6px 16px ${SH.ink3}`;
export const SOLID_SHADOW = `0 6px 16px -4px ${SH.ink2}, 0 16px 32px -8px ${SH.ink3}`;
export const TEXT_SHADOW = `0 2px 6px ${SH.ink2}, 0 10px 30px -6px ${SH.ink3}`;

export const GLASS = {
  card: "rgba(255,255,255,0.92)",
  pill: "rgba(255,255,255,0.82)",
  border: "rgba(255,255,255,0.65)",
};

export const SAFE = { x: 120, y: 100 };
export const CONTENT_WIDTH = 1920 - SAFE.x * 2;
export const HEADER_OFFSET = 250;

export const SPACE = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 };
export const RADIUS = { card: 24, box: 18, chip: 14, pill: 999 };
export const FS = { hero: 96, title: 48, heading: 40, body: 36, caption: 30, label: 24, small: 20 };
export const BORDER = { card: 2, accent: 3, dashed: 1 };
export const ANIM = { stagger: 20, fade: 22, rise: 40 };

export const springIn = (frame: number, fps: number, delay = 0, style: "spring" | "linear" | "float" = "spring") => {
  const cfg =
    style === "linear" ? { damping: 200, stiffness: 100, mass: 1 }
    : style === "float" ? { damping: 15, stiffness: 60, mass: 1.2 }
    : { damping: 8, stiffness: 100, mass: 0.9 };
  return spring({ frame: frame - delay, fps, config: cfg });
};

export const DECOR = {
  ring: "rgba(255,255,255,0.55)",
  ringAccent: "rgba(59,111,245,0.10)",
  grid: "rgba(28,37,54,0.035)",
  glow: "rgba(59,111,245,0.18)",
};

export const ACCENT_GRAD = `linear-gradient(90deg, ${C.accent}, #2fc6a1)`;
export const ACCENT_GRAD_SOFT = `linear-gradient(90deg, ${C.accent}cc, #2fc6a1cc)`;

export const PAPER = { base: "22", mid: "33", top: "40", deep: "55" };

export const BG_VARIANTS: Record<string, { grad: string; orb: string; orbColor: string }> = {
  title: { grad: "linear-gradient(150deg,#eef3ff 0%,#dbe7ff 55%,#cdddff 100%)", orb: "520px", orbColor: "#bcd2ff" },
  section: { grad: "linear-gradient(150deg,#eef7ff 0%,#ddeeff 45%,#cfe8ff 100%)", orbColor: "#b9defc", orb: "560px" },
  chart: { grad: "linear-gradient(150deg,#f4f8ff 0%,#e9f3ff 50%,#ddeeff 100%)", orbColor: "#c5dcff", orb: "520px" },
  art: { grad: "linear-gradient(160deg,#f2f7ff 0%,#e7f1ff 45%,#dcebff 100%)", orbColor: "#bfd8ff", orb: "520px" },
  end: { grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)", orbColor: "#cfe3ff", orb: "520px" },
  default: { grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)", orbColor: "#cfe3ff", orb: "520px" },
};

export type ThemeId = "tech" | "business" | "fresh" | "warm" | "dark";

export interface ThemePreset {
  label: string;
  bg: Record<string, { grad: string; orb: string; orbColor: string }>;
}

const baseOrb = "520px";

export const THEMES: Record<ThemeId, ThemePreset> = {
  tech: {
    label: "科技蓝",
    bg: {
      title: { grad: "linear-gradient(150deg,#eef3ff 0%,#dbe7ff 55%,#cdddff 100%)", orb: baseOrb, orbColor: "#bcd2ff" },
      section: { grad: "linear-gradient(150deg,#eef7ff 0%,#ddeeff 45%,#cfe8ff 100%)", orb: "560px", orbColor: "#b9defc" },
      chart: { grad: "linear-gradient(150deg,#f4f8ff 0%,#e9f3ff 50%,#ddeeff 100%)", orb: baseOrb, orbColor: "#c5dcff" },
      art: { grad: "linear-gradient(160deg,#f2f7ff 0%,#e7f1ff 45%,#dcebff 100%)", orb: baseOrb, orbColor: "#bfd8ff" },
      end: { grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)", orb: baseOrb, orbColor: "#cfe3ff" },
      default: { grad: "linear-gradient(150deg,#f6f9ff 0%,#eef4ff 45%,#e8f2ff 100%)", orb: baseOrb, orbColor: "#cfe3ff" },
    },
  },
  business: {
    label: "商务蓝",
    bg: {
      title: { grad: "linear-gradient(150deg,#eef2f8 0%,#dbe4f0 55%,#c9d6e8 100%)", orb: baseOrb, orbColor: "#b8c8e0" },
      section: { grad: "linear-gradient(150deg,#eef4f9 0%,#dde8f2 45%,#cfe0ee 100%)", orb: "560px", orbColor: "#b6cbe2" },
      chart: { grad: "linear-gradient(150deg,#f2f6fa 0%,#e6eef6 50%,#d9e6f2 100%)", orb: baseOrb, orbColor: "#c2d2e6" },
      art: { grad: "linear-gradient(160deg,#f0f5fa 0%,#e3edf5 45%,#d6e4f0 100%)", orb: baseOrb, orbColor: "#bccfe4" },
      end: { grad: "linear-gradient(150deg,#f4f7fb 0%,#ecf2f8 45%,#e4edf5 100%)", orb: baseOrb, orbColor: "#cbd9ea" },
      default: { grad: "linear-gradient(150deg,#f4f7fb 0%,#ecf2f8 45%,#e4edf5 100%)", orb: baseOrb, orbColor: "#cbd9ea" },
    },
  },
  fresh: {
    label: "清新绿",
    bg: {
      title: { grad: "linear-gradient(150deg,#eefaf3 0%,#d9f2e4 55%,#c8ecda 100%)", orb: baseOrb, orbColor: "#b8e6cd" },
      section: { grad: "linear-gradient(150deg,#eefaf5 0%,#ddf2e8 45%,#cdeee0 100%)", orb: "560px", orbColor: "#b3e3c9" },
      chart: { grad: "linear-gradient(150deg,#f2fbf6 0%,#e6f6ec 50%,#d9f2e4 100%)", orb: baseOrb, orbColor: "#c0e8d2" },
      art: { grad: "linear-gradient(160deg,#f0faf4 0%,#e4f5ea 45%,#d8f1e2 100%)", orb: baseOrb, orbColor: "#bae6cc" },
      end: { grad: "linear-gradient(150deg,#f4fbf7 0%,#ecf8f0 45%,#e4f5ea 100%)", orb: baseOrb, orbColor: "#c8ecd8" },
      default: { grad: "linear-gradient(150deg,#f4fbf7 0%,#ecf8f0 45%,#e4f5ea 100%)", orb: baseOrb, orbColor: "#c8ecd8" },
    },
  },
  warm: {
    label: "暖橙",
    bg: {
      title: { grad: "linear-gradient(150deg,#fff6ee 0%,#ffe9d8 55%,#ffddc6 100%)", orb: baseOrb, orbColor: "#ffd0b0" },
      section: { grad: "linear-gradient(150deg,#fff7f0 0%,#ffecdd 45%,#ffe3cf 100%)", orb: "560px", orbColor: "#ffd2b4" },
      chart: { grad: "linear-gradient(150deg,#fffaf4 0%,#fff0e4 50%,#ffe6d4 100%)", orb: baseOrb, orbColor: "#ffd8bd" },
      art: { grad: "linear-gradient(160deg,#fff8f1 0%,#ffede0 45%,#ffe3d2 100%)", orb: baseOrb, orbColor: "#ffd4b8" },
      end: { grad: "linear-gradient(150deg,#fffbf7 0%,#fff3ea 45%,#ffecdf 100%)", orb: baseOrb, orbColor: "#ffdcc6" },
      default: { grad: "linear-gradient(150deg,#fffbf7 0%,#fff3ea 45%,#ffecdf 100%)", orb: baseOrb, orbColor: "#ffdcc6" },
    },
  },
  dark: {
    label: "深空",
    bg: {
      title: { grad: "linear-gradient(150deg,#1a2233 0%,#232f47 55%,#2c3a58 100%)", orb: baseOrb, orbColor: "#3a4f7a" },
      section: { grad: "linear-gradient(150deg,#1b2436 0%,#24314a 45%,#2e3d5c 100%)", orb: "560px", orbColor: "#3d5480" },
      chart: { grad: "linear-gradient(150deg,#1c2538 0%,#26334d 50%,#30405f 100%)", orb: baseOrb, orbColor: "#405a88" },
      art: { grad: "linear-gradient(160deg,#1b2437 0%,#25324c 45%,#2f3e5d 100%)", orb: baseOrb, orbColor: "#3e5682" },
      end: { grad: "linear-gradient(150deg,#1d2639 0%,#27344e 45%,#31415f 100%)", orb: baseOrb, orbColor: "#425c8a" },
      default: { grad: "linear-gradient(150deg,#1d2639 0%,#27344e 45%,#31415f 100%)", orb: baseOrb, orbColor: "#425c8a" },
    },
  },
};

export const DEFAULT_THEME: ThemeId = "tech";
