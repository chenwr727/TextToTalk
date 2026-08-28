import React from "react";

type InterpOpts = {
  extrapolateLeft?: "extend" | "clamp" | "wrap" | "identity";
  extrapolateRight?: "extend" | "clamp" | "wrap" | "identity";
  output?: "linear" | "perceptual-scale";
};

export const interpolate = (
  _frame: number,
  _inputRange: readonly number[],
  outputRange: readonly number[],
  _opts?: InterpOpts
): number => outputRange[outputRange.length - 1];

export const useCurrentFrame = (): number => 1e9;

export const spring = (..._args: unknown[]): number => 1;

export const AbsoluteFill: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
}> = ({ style, children, className }) =>
  React.createElement(
    "div",
    {
      className,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...style,
      },
    },
    children
  );

export const Sequence: React.FC<{
  from?: number;
  durationInFrames?: number;
  children?: React.ReactNode;
  [k: string]: unknown;
}> = ({ children }) => React.createElement(React.Fragment, null, children);

export const useVideoConfig = () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 1e9 });
export const useVideo = () => null;

export const Audio = () => null;
export const Video = () => null;

export const Composition = () => null;
export const registerRoot = () => {};
