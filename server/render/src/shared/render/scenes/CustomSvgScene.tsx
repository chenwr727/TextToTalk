import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath, getBoundingBox } from "@remotion/paths";
import { C, FONT, FS, FW, RADIUS, CARD_SHADOW, GLASS, springIn, accentOf, BORDER, measureTextWidth } from "../theme";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { Icon } from "../Icon";
import { useResponsive, useCaptionReserve } from "../responsive";
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
 * 竖屏重排：把「横向排开的节点链」立成一列。
 *
 * 竖屏最常见的一类示意图是「A → B → C」的横向流程，在 1920×1080 里很舒服，
 * 但塞进 1080×1920 后：宽度用满 → 图形只有 ~200px 高（占画布 7%），上下各空 600+px，
 * 无论怎么放大都填不上（上限受宽度约束，纵横比是死的）。这类图真正的解法是换一种
 * 组织方式 —— 把节点按顺序竖排、连接线改成竖向箭头。
 *
 * 只处理能确认是「单行节点链」的情形，其余（多行、有图例、有自由曲线）返回 null，
 * 由调用方退回到等比缩放。判定条件：
 *   1. 有 ≥2 个"节点"（rect / circle / ellipse 且宽高都 ≥50）；
 *   2. 按 x 区间把节点聚成列，列与列之间不重叠；
 *   3. 除节点与节点内的元素之外的图元，只能是「细长的横向连接件」或「小装饰」
 *      （箭头三角等），否则视为复杂图，放弃重排。
 */
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type ChainLayout = { els: SvgElement[]; rows: number; rowH: number };

export function buildPortraitChain(
  els: SvgElement[],
  box: { x: number; y: number; w: number; h: number },
): ChainLayout | null {
  if (els.length < 2) return null;
  const bs = els.map(elementBounds);
  const area = (b: Bounds) => Math.max(b.maxX - b.minX, 0) * Math.max(b.maxY - b.minY, 0);

  // 1. 节点：矩形 / 圆 / 椭圆，且两个方向都够大（排除小圆点、圆角小方块）
  const nodeIdx = els
    .map((el, i) => ({ el, i, b: bs[i] }))
    .filter(
      ({ el, b }) =>
        (el.type === "rect" || el.type === "circle" || el.type === "ellipse") &&
        b.maxX - b.minX >= 50 &&
        b.maxY - b.minY >= 50,
    );
  if (nodeIdx.length < 2) return null;

  // 2. 按 x 区间聚成列
  const cols: { minX: number; minY: number; maxX: number; maxY: number; nodes: number[] }[] = [];
  for (const n of nodeIdx.slice().sort((a, b) => a.b.minX - b.b.minX)) {
    const last = cols[cols.length - 1];
    const overlap = last ? Math.min(last.maxX, n.b.maxX) - Math.max(last.minX, n.b.minX) : -1;
    const narrow = last ? Math.min(last.maxX - last.minX, n.b.maxX - n.b.minX) : 0;
    if (last && overlap > narrow * 0.5) {
      last.minX = Math.min(last.minX, n.b.minX);
      last.maxX = Math.max(last.maxX, n.b.maxX);
      last.minY = Math.min(last.minY, n.b.minY);
      last.maxY = Math.max(last.maxY, n.b.maxY);
      last.nodes.push(n.i);
    } else {
      cols.push({ minX: n.b.minX, minY: n.b.minY, maxX: n.b.maxX, maxY: n.b.maxY, nodes: [n.i] });
    }
  }
  if (cols.length < 2 || cols.length > 4) return null;
  for (let c = 1; c < cols.length; c++) if (cols[c].minX < cols[c - 1].maxX) return null;
  /*
   * 每列只能有 1 个节点。
   *
   * 一列叠两个节点（例如 2×2 的对照图）说明它是网格而不是链，竖排会把同一列的两个
   * 节点塞进同一行、互相压住（实测「旧流程 / 11 道审批」被叠在一起）。这种情况退回
   * 等比缩放，让原图自己保持形状。
   */
  if (cols.some((c) => c.nodes.length !== 1)) return null;

  // 3. 其余图元：节点内的（文字等）归入所在列；剩下的只能是连接件或小装饰
  const inCol = new Set<number>();
  for (const col of cols) {
    for (let i = 0; i < els.length; i++) {
      if (inCol.has(i) || col.nodes.includes(i)) continue;
      const b = bs[i];
      const cxm = (b.minX + b.maxX) / 2;
      const cym = (b.minY + b.maxY) / 2;
      if (cxm >= col.minX && cxm <= col.maxX && cym >= col.minY && cym <= col.maxY) inCol.add(i);
    }
  }
  const nodeSet = new Set(nodeIdx.map((n) => n.i));
  const minNodeArea = Math.min(...nodeIdx.map((n) => area(n.b)));
  const connectors: { idx: number; col: number }[] = [];
  for (let i = 0; i < els.length; i++) {
    if (nodeSet.has(i) || inCol.has(i)) continue;
    const b = bs[i];
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const thin = h <= Math.max(24, w * 0.35) && w >= 30;
    if (thin) {
      const cxm = (b.minX + b.maxX) / 2;
      const col = cols.findIndex((c, ci) => ci < cols.length - 1 && cxm >= c.maxX - 1 && cxm <= cols[ci + 1].minX + 1);
      if (col >= 0) {
        connectors.push({ idx: i, col });
        continue;
      }
    }
    // 小装饰（箭头三角、圆点）：丢掉不重排，不影响语义
    if (area(b) <= minNodeArea * 0.25) continue;
    // 其余图元归类不了（图例、自由曲线、不在列间的连线…）→ 放弃重排
    return null;
  }

  // 4. 竖排：每列一行，节点等比放大到能填满可用带
  const nodeW = Math.max(...cols.map((c) => c.maxX - c.minX));
  const nodeH = Math.max(...cols.map((c) => c.maxY - c.minY));
  const rows = cols.length;
  const rowH = box.h / rows;
  const gap = Math.min(rowH * 0.34, 120);
  // 上限 2.6：竖排后每行最多 ~400px 高，再放大字号就爆了
  const s = Math.max(0.5, Math.min((box.w * 0.92) / nodeW, (rowH - gap) / nodeH, 2.6));

  const out: SvgElement[] = [];
  const colCenterX = box.x + box.w / 2;
  const stroke = connectors.length ? (els[connectors[0].idx].stroke ?? accentOf(0)) : accentOf(0);
  const strokeW = connectors.length ? (els[connectors[0].idx].strokeWidth ?? 4) : 4;

  cols.forEach((col, ci) => {
    const bcx = (col.minX + col.maxX) / 2;
    const bcy = (col.minY + col.maxY) / 2;
    const cy = box.y + rowH * (ci + 0.5);
    const dx = colCenterX - bcx * s;
    const dy = cy - bcy * s;
    const members = new Set<number>([...col.nodes]);
    for (const i of inCol) {
      const b = bs[i];
      const cxm = (b.minX + b.maxX) / 2;
      const cym = (b.minY + b.maxY) / 2;
      if (cxm >= col.minX && cxm <= col.maxX && cym >= col.minY && cym <= col.maxY) members.add(i);
    }
    for (const i of members) {
      const el = els[i];
      const next: SvgElement = { ...el };
      const sx = (v: number | undefined) => (typeof v === "number" ? v * s + dx : v);
      const sy = (v: number | undefined) => (typeof v === "number" ? v * s + dy : v);
      if (el.type === "text" || el.type === "rect") {
        next.x = sx(el.x);
        next.y = sy(el.y);
      }
      if (el.type === "circle" || el.type === "ellipse") {
        next.cx = sx(el.cx);
        next.cy = sy(el.cy);
      }
      if (el.type !== "text" && el.type !== "line") {
        if (typeof el.r === "number") next.r = el.r * s;
        if (typeof el.rx === "number") next.rx = el.rx * s;
        if (typeof el.ry === "number") next.ry = el.ry * s;
        if (typeof el.width === "number") next.width = el.width * s;
        if (typeof el.height === "number") next.height = el.height * s;
      }
      if (el.type === "text") {
        // 字号跟着放大但设上限，避免竖排后被拉成巨字
        next.fontSize = Math.min(120, (el.fontSize ?? 28) * s);
      }
      out.push(next);
    }
    if (ci < rows - 1) {
      // 竖向连接件：从本行卡片底到下一行卡片顶，带箭头
      const y1 = cy + (col.maxY - col.minY) * s * 0.5 + 10;
      const y2 = cy + rowH - (cols[ci + 1].maxY - cols[ci + 1].minY) * s * 0.5 - 10;
      out.push({
        type: "line",
        x1: colCenterX,
        y1,
        x2: colCenterX,
        y2: Math.max(y1 + 20, y2),
        stroke,
        strokeWidth: Math.min(10, strokeW * Math.min(s, 1.8)),
      });
      out.push({
        type: "polygon",
        points: `${colCenterX - 10},${Math.max(y1 + 20, y2) - 16} ${colCenterX + 10},${Math.max(y1 + 20, y2) - 16} ${colCenterX},${Math.max(y1 + 20, y2)}`,
        fill: stroke,
      });
    }
  });

  return { els: out, rows, rowH };
}

/**
 * 竖屏安全区的高度要跟着内容的纵横比走。
 *
 * 第一版把高度写死成 `contentHeight * 0.56`：一张 3.2:1 的宽流程图塞进高盒子后
 * 由宽度定标，实际只占 300px，上下的空盒子各留了 400px 白。这里按"内容等比放大后
 * 再多留 30% 边距"给高度，并夹在可用高度之内。
 */
export function portraitSafeH(els: SvgElement[], safeW: number, availH: number): number {
  if (!els.length) return Math.round(availH * 0.6);
  const bounds = els.map(elementBounds);
  const contentW = Math.max(Math.max(...bounds.map((b) => b.maxX)) - Math.min(...bounds.map((b) => b.minX)), 100);
  const contentH = Math.max(Math.max(...bounds.map((b) => b.maxY)) - Math.min(...bounds.map((b) => b.minY)), 100);
  const fitH = (contentH / contentW) * safeW * 1.3;
  return Math.round(Math.min(availH, Math.max(320, fitH)));
}

export const CustomSvgScene: React.FC<SceneProps> = ({ page, subtitles, fps }) => {
  const f = useCurrentFrame();
  const { isPortrait, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const { contentTop } = useHeadingMetrics();
  const captionReserve = useCaptionReserve(
    subtitles,
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []),
  );
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
  const portraitBand = useMemo(() => {
    const x = Math.round(sp(48));
    const top = contentTop;
    const bottom = Math.round(contentHeight - Math.max(captionReserve, sp(120)));
    return { x, y: top, w: Math.round(contentWidth - sp(96)), h: Math.max(320, bottom - top) };
  }, [sp, contentTop, captionReserve, contentWidth, contentHeight]);
  /*
   * 竖屏两种走法：
   *   - 能识别成「单行节点链」→ 竖排（buildPortraitChain），直接铺满标题到字幕之间；
   *   - 否则退回到等比缩放，安全区高度跟着内容纵横比走（portraitSafeH）。
   */
  const chain = useMemo(
    () => (isPortrait ? buildPortraitChain(spec, portraitBand) : null),
    [spec, isPortrait, portraitBand],
  );
  const safe = isPortrait
    ? chain
      ? portraitBand
      : (() => {
          const w = portraitBand.w;
          const h = portraitSafeH(spec, w, portraitBand.h);
          return {
            x: portraitBand.x,
            y: portraitBand.y + Math.max(0, (portraitBand.h - h) / 2),
            w,
            h,
          };
        })()
    : SAFE;
  const rendered = chain ? chain.els : spec;
  const { scale, tx, ty } = useMemo(
    () => (chain ? { scale: 1, tx: 0, ty: 0 } : computeFitTransform(spec, safe)),
    [spec, safe, chain],
  );

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
              {rendered.map((el, i) => (
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
