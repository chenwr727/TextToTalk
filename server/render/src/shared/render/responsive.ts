import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import { measureTextWidth } from "./theme";

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

  const fsScale = 1;
  const spScale = isPortrait ? 0.85 : 1;

  const safeX = isPortrait ? 64 : 120;
  const safeY = isPortrait ? 80 : 100;
  const contentWidth = width - safeX * 2;
  const contentHeight = height - safeY * 2;

  const fs = (designPx: number) => Math.round(designPx * fsScale);
  const sp = (designPx: number) => Math.round(designPx * spScale);
  return { width, height, isPortrait, contentWidth, contentHeight, safeX, safeY, fs, sp };
};

export const useCaptionReserve = (subtitles: boolean, texts: string[] = []): number => {
  const { isPortrait, fs, sp, width } = useResponsive();
  if (!subtitles) return 0;
  const m = CAPTION_METRICS;
  const fSize = fs(m.fontSize);
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