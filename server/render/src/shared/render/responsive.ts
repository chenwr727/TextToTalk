import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import { measureTextWidth } from "./theme";
import { estLinesWith } from "./fit";

export { portraitFill } from "./fit";

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const CAPTION_METRICS = {
  bottom: 60,
  fontSize: 42,
  lineHeight: 1.4,
  padY: 16,
  padX: 42,
  maxWidthPortrait: 0.88,
  maxWidthLandscape: 0.78,
  margin: 24,
};

export interface Responsive {
  width: number;
  height: number;
  isPortrait: boolean;
  contentWidth: number;
  contentHeight: number;
  safeX: number;
  safeY: number;
  fs: (designPx: number) => number;
  sp: (designPx: number) => number;
}

export const ResponsiveContext = createContext<{ width: number; height: number } | null>(null);

export const useResponsive = (): Responsive => {
  const injected = useContext(ResponsiveContext);
  const video = useVideoConfig();
  const width = injected?.width ?? video.width;
  const height = injected?.height ?? video.height;
  const isPortrait = height > width;

  // 竖屏画布宽 1080、可用宽只有 952，而所有版式的字号是按 1920 宽设计的。
  // 这里长期写死 fsScale = 1，导致竖屏直接套用横屏字号：正文占宽度比例翻倍，
  // 卡片里的文字会溢出（three_card 实测溢出卡片底边）、表格列宽挤成一团。
  // 0.82 让"每行容纳的字数"接近横屏水平，同时不至于在手机上偏小；字幕单独处理（见 Caption.tsx），
  // 因为手机上字幕要保持大字号，不跟着正文一起缩。
  const fsScale = isPortrait ? 0.82 : 1;
  const spScale = isPortrait ? 0.85 : 1;

  const safeX = isPortrait ? 64 : 120;
  const safeY = isPortrait ? 80 : 100;
  const contentWidth = width - safeX * 2;
  const contentHeight = height - safeY * 2;

  const fs = (designPx: number) => Math.round(designPx * fsScale);
  const sp = (designPx: number) => Math.round(designPx * spScale);
  return { width, height, isPortrait, contentWidth, contentHeight, safeX, safeY, fs, sp };
};

/**
 * 估算一段文字在给定宽度下会折成几行。
 *
 * 场景里的"内容会不会溢出 / 有多空"只能靠估：渲染前拿不到真实布局。
 * 用与字幕预留同一套 `measureTextWidth`，估偏了也只是大小差一档，不会破版。
 * 纯逻辑在 fit.ts（那边能单测，这里只负责注入真实字体度量）。
 */
export const estLines = estLinesWith(measureTextWidth);

export const useCaptionReserve = (subtitles: boolean, texts: string[] = []): number => {
  const { isPortrait, sp, width } = useResponsive();
  if (!subtitles) return 0;
  const m = CAPTION_METRICS;
  const fSize = Math.round(m.fontSize * (isPortrait ? 0.92 : 1));
  const padX = sp(m.padX);
  const barMaxW = width * (isPortrait ? m.maxWidthPortrait : m.maxWidthLandscape);
  const textW = Math.max(80, barMaxW - 10 - padX * 2);
  const lines = texts.length
    ? texts.reduce((max, t) => {
        const w = measureTextWidth(t, fSize, 600);
        return Math.max(max, Math.max(1, Math.ceil(w / textW)));
      }, 1)
    : 1;
  return (
    (isPortrait ? sp(m.bottom) : m.bottom) +
    fSize * m.lineHeight * lines +
    (isPortrait ? sp(m.padY) : m.padY) * 2 +
    m.margin
  );
};
