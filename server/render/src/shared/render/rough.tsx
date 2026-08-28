import React, { useLayoutEffect, useRef, useState } from "react";

type Rect = { w: number; h: number };

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setRect((prev) =>
        prev && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
          ? prev
          : { w: r.width, h: r.height }
      );
    }
  });
  return [ref, rect] as const;
}

export const HandHighlight: React.FC<{
  children: React.ReactNode;
  color?: string;
  progress: number;
}> = ({ children, color = "#ffd54a", progress }) => {
  const [ref, rect] = useMeasure<HTMLSpanElement>();
  const w = rect?.w ?? 0;
  const h = rect?.h ?? 0;
  const padX = 6;
  const barW = w + padX * 2;
  const barH = Math.max(18, h * 0.42);
  const top = h * 0.72;
  const safeProgress = Math.max(0, Math.min(1, progress));

  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "pre-wrap" }}>
      {rect && safeProgress > 0 && (
        <svg
          width={barW}
          height={barH}
          style={{
            position: "absolute",
            left: -padX,
            top,
            overflow: "visible",
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <path
            d={`M 4 ${barH * 0.6} C ${barW * 0.25} ${barH * 0.2}, ${barW * 0.7} ${barH * 1.1}, ${barW - 4} ${barH * 0.5}`}
            fill="none"
            stroke={color}
            strokeWidth={barH * 0.55}
            strokeLinecap="round"
            opacity={0.85}
            strokeDasharray={`${barW} ${barW}`}
            strokeDashoffset={barW * (1 - safeProgress)}
          />
        </svg>
      )}
      <span ref={ref} style={{ position: "relative" }}>{children}</span>
    </span>
  );
};

export const HandUnderline: React.FC<{
  children: React.ReactNode;
  color?: string;
  progress: number;
  strokeWidth?: number;
  iterations?: number;
}> = ({ children, color = "currentColor", progress, strokeWidth, iterations = 2 }) => {
  const [ref, rect] = useMeasure<HTMLSpanElement>();
  const w = rect?.w ?? 0;
  const h = rect?.h ?? 0;
  const padX = 8;
  const barW = w + padX * 2;
  const sw = strokeWidth ?? Math.max(6, h * 0.18);
  const y = h + 4;
  const safeProgress = Math.max(0, Math.min(1, progress));

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < iterations; i++) {
    const lineProgress = Math.max(0, Math.min(1, safeProgress * iterations - i));
    const offset = i % 2 === 0 ? 0 : 2;
    lines.push(
      <path
        key={i}
        d={`M 4 ${y + offset} C ${barW * 0.25} ${y + offset - 3}, ${barW * 0.7} ${y + offset + 5}, ${barW - 4} ${y + offset}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.85}
        strokeDasharray={`${barW} ${barW}`}
        strokeDashoffset={barW * (1 - lineProgress)}
      />
    );
  }

  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "pre-wrap" }}>
      <span ref={ref} style={{ position: "relative" }}>{children}</span>
      {rect && safeProgress > 0 && (
        <svg
          width={barW}
          height={sw * 2 + 12}
          style={{
            position: "absolute",
            left: -padX,
            top: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {lines}
        </svg>
      )}
    </span>
  );
};