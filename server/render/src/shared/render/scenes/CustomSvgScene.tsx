import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath, getBoundingBox } from "@remotion/paths";
import { C, FONT, FS, RADIUS, CARD_SHADOW, springIn, accentOf, BORDER, measureTextWidth } from "../theme";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import { Icon } from "../Icon";
import type { SceneProps } from "./types";
import type { SvgElement } from "../props";

const CANVAS = { w: 1920, h: 1080 };
const SAFE = { x: 80, y: 240, w: 1760, h: 540 };

const BottomPoints: React.FC<{ page: SceneProps["page"]; fps: number }> = ({ page, fps }) => {
  const f = useCurrentFrame();
  const items = page.points ?? [];
  if (!items.length) return null;
  return (
    <div style={{ position: "absolute", bottom: 180, left: 0, right: 0, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, rowGap: 12, padding: "0 120px" }}>
      {items.map((it, i) => {
        const o = springIn(f, fps, 30 + i * 20, page.motion);
        return (
          <div key={i} style={{
            opacity: o, transform: `translateY(${interpolate(o, [0, 1], [40, 0])}px)`,
            background: "rgba(255,255,255,0.92)", border: `${BORDER.card}px solid ${accentOf(i)}`,
            borderRadius: RADIUS.box, padding: "16px 24px", fontSize: FS.body, fontWeight: 700,
            color: C.ink, fontFamily: FONT, textAlign: "center", flex: "0 1 auto", minWidth: 200, boxShadow: CARD_SHADOW,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <Icon name={pointIcon(it, i)} size={22} color={accentOf(i)} />
            <span>{pointText(it, i)}</span>
          </div>
        );
      })}
    </div>
  );
};

function elementBounds(el: SvgElement): { minX: number; minY: number; maxX: number; maxY: number } {
  const num = (...xs: (number | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
  const min = (...xs: (number | undefined)[]) => Math.min(...num(...xs));
  const max = (...xs: (number | undefined)[]) => Math.max(...num(...xs));

  switch (el.type) {
    case "circle": {
      const cx = el.cx ?? 0, cy = el.cy ?? 0, r = el.r ?? 0;
      return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
    }
    case "rect": {
      const x = el.x ?? 0, y = el.y ?? 0;
      return { minX: x, minY: y, maxX: x + (el.width ?? 0), maxY: y + (el.height ?? 0) };
    }
    case "ellipse": {
      const cx = el.cx ?? 0, cy = el.cy ?? 0, rx = el.rx ?? 0, ry = el.ry ?? 0;
      return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
    }
    case "line":
      return { minX: min(el.x1, el.x2), minY: min(el.y1, el.y2), maxX: max(el.x1, el.x2), maxY: max(el.y1, el.y2) };
    case "polygon": {
      const pts = (el.points ?? "").split(/\s+/).map((p) => p.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
      if (!pts.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      return { minX: Math.min(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxX: Math.max(...pts.map((p) => p[0])), maxY: Math.max(...pts.map((p) => p[1])) };
    }
    case "path": {
      try {
        const b = getBoundingBox(el.d ?? "");
        return { minX: b.x1, minY: b.y1, maxX: b.x2, maxY: b.y2 };
      } catch {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }
    }
    case "text": {
      const fs = el.fontSize ?? 28;
      const text = el.text ?? "";
      const width = measureTextWidth(text, fs, el.fontWeight ?? 700);
      const anchor = el.textAnchor ?? "start";
      const x = el.x ?? 0;
      const minX = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      return { minX, minY: (el.y ?? 0) - fs / 2, maxX: minX + width, maxY: (el.y ?? 0) + fs / 2 };
    }
    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}

function computeFitTransform(els: SvgElement[]): { scale: number; tx: number; ty: number } {
  if (!els.length) return { scale: 1, tx: 0, ty: 0 };
  const bounds = els.map(elementBounds);
  const minX = Math.min(...bounds.map((b) => b.minX));
  const minY = Math.min(...bounds.map((b) => b.minY));
  const maxX = Math.max(...bounds.map((b) => b.maxX));
  const maxY = Math.max(...bounds.map((b) => b.maxY));

  const contentW = Math.max(maxX - minX, 100);
  const contentH = Math.max(maxY - minY, 100);
  const scaleX = SAFE.w / contentW;
  const scaleY = SAFE.h / contentH;
  const scale = Math.min(scaleX, scaleY, 1.35);

  const fitW = contentW * scale;
  const fitH = contentH * scale;
  const tx = SAFE.x + (SAFE.w - fitW) / 2 - minX * scale;
  const ty = SAFE.y + (SAFE.h - fitH) / 2 - minY * scale;
  return { scale, tx, ty };
}

const SvgEl: React.FC<{ el: SvgElement; frame: number; fps: number; motion: "spring" | "linear" | "float" }> = ({ el, frame, fps, motion }) => {
  const delay = el.delay ?? 0;
  const o = springIn(frame, fps, delay, motion);
  const common = {
    opacity: o * (el.opacity ?? 1),
    transform: `translate(0, ${interpolate(o, [0, 1], [30, 0])})`,
  };
  const fill = el.fill ?? "none";
  const stroke = el.stroke;
  const strokeWidth = el.strokeWidth;

  switch (el.type) {
    case "circle":
      return <circle cx={el.cx} cy={el.cy} r={el.r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    case "rect":
      return <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={el.rx} ry={el.ry} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    case "ellipse":
      return <ellipse cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    case "line":
      return <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={stroke ?? "#3B6FF5"} strokeWidth={strokeWidth ?? 2} {...common} />;
    case "polygon":
      return <polygon points={el.points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    case "path": {
      const d = el.d ?? "";
      if (el.draw) {
        const bb = getBoundingBox(d);
        const len = Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1, 1);
        const drawFrames = Math.max(20, Math.round(len / 100 * 8));
        const progress = interpolate(frame, [delay, delay + drawFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
        const drawOpacity = frame < delay + drawFrames ? 1 : o;
        return (
          <path d={d} fill={fill} stroke={el.stroke ?? "#3B6FF5"} strokeWidth={strokeWidth ?? 3}
            strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            opacity={drawOpacity * (el.opacity ?? 1)}
            transform={common.transform} />
        );
      }
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    }
    case "text":
      return (
        <text x={el.x} y={el.y} textAnchor={el.textAnchor ?? "start"} dominantBaseline="central"
          fill={el.fill ?? C.ink} fontSize={el.fontSize ?? 28} fontWeight={el.fontWeight ?? 700} fontFamily={FONT} {...common}>
          {el.text}
        </text>
      );
    default:
      return null;
  }
};

export const CustomSvgScene: React.FC<SceneProps> = ({ page, fps }) => {
  const f = useCurrentFrame();
  const spec = page.customSvg;
  if (!spec || !spec.length) return null;
  const motion = page.motion ?? "spring";
  const { scale, tx, ty } = useMemo(() => computeFitTransform(spec), [spec]);

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={page.title} />
      <div style={{ flex: 1, position: "relative" }}>
        <svg width={CANVAS.w} height={CANVAS.h} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id="safe-mask">
              <rect x={0} y={0} width={CANVAS.w} height={CANVAS.h} fill="black" />
              <rect x={SAFE.x} y={SAFE.y} width={SAFE.w} height={SAFE.h} rx={24} fill="white" />
            </mask>
          </defs>
          <g mask="url(#safe-mask)">
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              {spec.map((el, i) => (
                <SvgEl key={i} el={el} frame={f} fps={fps} motion={motion} />
              ))}
            </g>
          </g>
        </svg>
      </div>
      <BottomPoints page={page} fps={fps} />
    </AbsoluteFill>
  );
};