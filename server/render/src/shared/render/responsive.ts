import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

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