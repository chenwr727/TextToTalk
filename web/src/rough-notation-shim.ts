import React from "react";

type RoughProps = {
  children?: React.ReactNode;
  progress?: number;
  color?: string;
  strokeWidth?: number;
  iterations?: number;
  padding?: number | Partial<{ top: number; right: number; bottom: number; left: number }>;
  [k: string]: unknown;
};

const passthrough: React.FC<RoughProps> = ({ children }) => React.createElement(React.Fragment, null, children);

export const Highlight = passthrough;
export const Underline = passthrough;
export const Circle = passthrough;
export const Box = passthrough;
export const StrikeThrough = passthrough;
export const CrossedOff = passthrough;
export const Bracket = passthrough;