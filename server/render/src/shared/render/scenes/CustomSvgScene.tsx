import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath, getBoundingBox } from "@remotion/paths";
import { C, FONT, FS, FW, RADIUS, CARD_SHADOW, GLASS, springIn, accentOf, BORDER, measureTextWidth } from "../theme";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { Icon } from "../Icon";
import { useResponsive } from "../responsive";
import { useSceneTiming, resolveAnchor, type SceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";
import type { SvgElement } from "../props";

const CANVAS = { w: 1920, h: 1080 };
const SAFE = { x: 24, y: 240, w: 1760, h: 540 };

const BottomPoints: React.FC<{ page: SceneProps["page"]; fps: number }> = ({ page, fps }) => {
  const f = useCurrentFrame();
  const { isPortrait, sp } = useResponsive();
  const timing = useSceneTiming();
  const items = page.points ?? [];
  if (!items.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: isPortrait ? sp(180) : 180,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: isPortrait ? sp(16) : 16,
        rowGap: isPortrait ? sp(12) : 12,
        padding: isPortrait ? `0 ${sp(120)}px` : "0 120px",
      }}
    >
      {items.map((it, i) => {
        const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i, 30, 20), page.motion);
        return (
          <div
            key={i}
            style={{
              opacity: o,
              transform: `translateY(${interpolate(o, [0, 1], [40, 0])}px)`,
              background: GLASS.card,
              border: `${BORDER.card}px solid ${accentOf(i)}`,
              borderRadius: RADIUS.box,
              padding: "16px 24px",
              fontSize: FS.body,
              fontWeight: FW.bold,
              color: C.ink,
              fontFamily: FONT,
              textAlign: "center",
              flex: "0 1 auto",
              minWidth: 200,
              boxShadow: CARD_SHADOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
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
      const cx = el.cx ?? 0,
        cy = el.cy ?? 0,
        r = el.r ?? 0;
      return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
    }
    case "rect": {
      const x = el.x ?? 0,
        y = el.y ?? 0;
      return { minX: x, minY: y, maxX: x + (el.width ?? 0), maxY: y + (el.height ?? 0) };
    }
    case "ellipse": {
      const cx = el.cx ?? 0,
        cy = el.cy ?? 0,
        rx = el.rx ?? 0,
        ry = el.ry ?? 0;
      return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
    }
    case "line":
      return { minX: min(el.x1, el.x2), minY: min(el.y1, el.y2), maxX: max(el.x1, el.x2), maxY: max(el.y1, el.y2) };
    case "polygon": {
      const pts = (el.points ?? "")
        .split(/\s+/)
        .map((p) => p.split(",").map(Number))
        .filter((p) => p.length === 2 && p.every(Number.isFinite));
      if (!pts.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      return {
        minX: Math.min(...pts.map((p) => p[0])),
        minY: Math.min(...pts.map((p) => p[1])),
        maxX: Math.max(...pts.map((p) => p[0])),
        maxY: Math.max(...pts.map((p) => p[1])),
      };
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

function computeFitTransform(
  els: SvgElement[],
  safe: { x: number; y: number; w: number; h: number },
): { scale: number; tx: number; ty: number } {
  if (!els.length) return { scale: 1, tx: 0, ty: 0 };
  const bounds = els.map(elementBounds);
  const minX = Math.min(...bounds.map((b) => b.minX));
  const minY = Math.min(...bounds.map((b) => b.minY));
  const maxX = Math.max(...bounds.map((b) => b.maxX));
  const maxY = Math.max(...bounds.map((b) => b.maxY));

  const contentW = Math.max(maxX - minX, 100);
  const contentH = Math.max(maxY - minY, 100);
  const scaleX = safe.w / contentW;
  const scaleY = safe.h / contentH;
  /*
   * 上限从 1.35 放宽到 2.2。
   *
   * AI 画的示意图坐标空间大小完全随机（有的画在 800×240 里，有的画在 4000×2000 里），
   * 1.35 的硬上限让小图只能占到安全区的六成、周围全是空的。
   * 不溢出的保证来自 min(scaleX, scaleY)，上限只负责"别把小图放得过分大"。
   */
  const scale = Math.min(scaleX, scaleY, 2.2);

  const fitW = contentW * scale;
  const fitH = contentH * scale;
  const tx = safe.x + (safe.w - fitW) / 2 - minX * scale;
  const ty = safe.y + (safe.h - fitH) / 2 - minY * scale;
  return { scale, tx, ty };
}

const SvgEl: React.FC<{
  el: SvgElement;
  index: number;
  frame: number;
  fps: number;
  motion: "spring" | "linear" | "float";
  timing: SceneTiming;
}> = ({ el, index, frame, fps, motion, timing }) => {
  const delay = resolveAnchor(timing, el.anchor, index, 0, 8) + (el.delay ?? 0);
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
      return (
        <circle cx={el.cx} cy={el.cy} r={el.r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
      );
    case "rect":
      return (
        <rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={el.rx}
          ry={el.ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          {...common}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={el.cx}
          cy={el.cy}
          rx={el.rx}
          ry={el.ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          {...common}
        />
      );
    case "line":
      return (
        <line
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={stroke ?? "#3B6FF5"}
          strokeWidth={strokeWidth ?? 2}
          {...common}
        />
      );
    case "polygon":
      return <polygon points={el.points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    case "path": {
      const d = el.d ?? "";
      if (el.draw) {
        const bb = getBoundingBox(d);
        const len = Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1, 1);
        const drawFrames = Math.max(20, Math.round((len / 100) * 8));
        const progress = interpolate(frame, [delay, delay + drawFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
        const drawOpacity = frame < delay + drawFrames ? 1 : o;
        return (
          <path
            d={d}
            fill={fill}
            stroke={el.stroke ?? "#3B6FF5"}
            strokeWidth={strokeWidth ?? 3}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            opacity={drawOpacity * (el.opacity ?? 1)}
            transform={common.transform}
          />
        );
      }
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />;
    }
    case "text":
      return (
        <text
          x={el.x}
          y={el.y}
          textAnchor={el.textAnchor ?? "start"}
          dominantBaseline="central"
          fill={el.fill ?? C.ink}
          fontSize={el.fontSize ?? 28}
          fontWeight={el.fontWeight ?? 700}
          fontFamily={FONT}
          {...common}
        >
          {el.text}
        </text>
      );
    default:
      return null;
  }
};

/**
 * 竖屏安全区的高度要跟着内容的纵横比走。
 *
 * 第一版把高度写死成 `contentHeight * 0.56`：一张 3.2:1 的宽流程图塞进高盒子后
 * 由宽度定标，实际只占 300px，上下的空盒子各留了 400px 白。这里按"内容等比放大后
 * 再多留 30% 边距"给高度，并夹在可用高度之内。
 */
export function portraitSafeH(
  els: SvgElement[],
  safeW: number,
  availH: number,
): number {
  if (!els.length) return Math.round(availH * 0.6);
  const bounds = els.map(elementBounds);
  const contentW = Math.max(Math.max(...bounds.map((b) => b.maxX)) - Math.min(...bounds.map((b) => b.minX)), 100);
  const contentH = Math.max(Math.max(...bounds.map((b) => b.maxY)) - Math.min(...bounds.map((b) => b.minY)), 100);
  const fitH = (contentH / contentW) * safeW * 1.3;
  return Math.round(Math.min(availH, Math.max(320, fitH)));
}

export const CustomSvgScene: React.FC<SceneProps> = ({ page, fps }) => {
  const f = useCurrentFrame();
  const { isPortrait, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const spec = page.customSvg;
  if (!spec || !spec.length) return null;
  const motion = page.motion ?? "spring";
  const canvas = isPortrait ? { w: contentWidth, h: contentHeight } : CANVAS;
  /*
   * 竖屏的安全区原来直接等于整块画布（x/y 都是 0、宽高等于画布）：
   * 宽图（样本 776×240）的缩放因此由**宽度**决定，`fitW` 正好等于 1080、`tx` 等于 0，
   * 左边框贴着画布边缘被 rx=24 的圆角遮罩切掉，整张图只剩 151px 高（占 1920 的 7.9%），
   * 上下各空 620px / 772px。竖屏改成"标题以下、留出左右边距"的一块画布，
   * 缩放到高度、宽度都留白，同时把圆角裁切挪到有明显边距的位置。
   */
  const safe = isPortrait
    ? (() => {
        const w = Math.round(contentWidth - sp(96));
        const h = portraitSafeH(spec, w, Math.round(contentHeight * 0.72));
        /*
         * 纵向位置：居中在"标题底（约 300）~ 字幕条顶"之间。
         * 写死 `y = sp(230)` 时，宽图放大后只有 300px 高，盒子上半个空档全留在下方。
         */
        const top = Math.round(sp(200));
        const bottom = Math.round(contentHeight - sp(220));
        return { x: Math.round(sp(48)), y: Math.round(top + Math.max(0, (bottom - top - h) / 2)), w, h };
      })()
    : SAFE;
  const { scale, tx, ty } = useMemo(() => computeFitTransform(spec, safe), [spec, safe]);

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={page.title} />
      <div style={{ flex: 1, position: "relative" }}>
        <svg width={canvas.w} height={canvas.h} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id="safe-mask">
              <rect x={0} y={0} width={canvas.w} height={canvas.h} fill="black" />
              <rect x={safe.x} y={safe.y} width={safe.w} height={safe.h} rx={24} fill="white" />
            </mask>
          </defs>
          <g mask="url(#safe-mask)">
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              {spec.map((el, i) => (
                <SvgEl key={i} el={el} index={i} frame={f} fps={fps} motion={motion} timing={timing} />
              ))}
            </g>
          </g>
        </svg>
      </div>
      <BottomPoints page={page} fps={fps} />
    </AbsoluteFill>
  );
};
