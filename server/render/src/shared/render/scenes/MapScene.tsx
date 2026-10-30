import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, FONT, FW, springIn, accentOf } from "../theme";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor, type SceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";
import type { MapSpec, MapRoute, MapRegion } from "../props";

const CANVAS = { w: 1920, h: 1080 };
const SAFE = { x: 80, y: 240, w: 1760, h: 540 };

function parsePolygon(points: string): [number, number][] {
  return points
    .split(/\s+/)
    .map((p) => p.split(",").map(Number) as [number, number])
    .filter((p) => p.length === 2 && p.every(Number.isFinite));
}

function computeMapBounds(
  spec: MapSpec,
  regionPolys: [number, number][][],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const markers = spec.markers ?? [];

  for (const m of markers) {
    xs.push(m.x);
    ys.push(m.y);
  }
  for (const poly of regionPolys) {
    for (const [px, py] of poly) {
      xs.push(px);
      ys.push(py);
    }
  }
  if (!xs.length) return { minX: 0, minY: 0, maxX: CANVAS.w, maxY: CANVAS.h };
  const minX = xs.reduce((a, v) => Math.min(a, v), Infinity);
  const minY = ys.reduce((a, v) => Math.min(a, v), Infinity);
  const maxX = xs.reduce((a, v) => Math.max(a, v), -Infinity);
  const maxY = ys.reduce((a, v) => Math.max(a, v), -Infinity);
  return { minX, minY, maxX, maxY };
}

function computeFitTransform(
  spec: MapSpec,
  regionPolys: [number, number][][],
  safe: { x: number; y: number; w: number; h: number },
  maxScale = 1.35,
): { scale: number; tx: number; ty: number } {
  const b = computeMapBounds(spec, regionPolys);
  const contentW = Math.max(b.maxX - b.minX, 100);
  const contentH = Math.max(b.maxY - b.minY, 100);
  const scaleX = safe.w / contentW;
  const scaleY = safe.h / contentH;
  const scale = Math.min(scaleX, scaleY, maxScale);

  const fitW = contentW * scale;
  const fitH = contentH * scale;
  const tx = safe.x + (safe.w - fitW) / 2 - b.minX * scale;
  const ty = safe.y + (safe.h - fitH) / 2 - b.minY * scale;
  return { scale, tx, ty };
}

const RegionEl: React.FC<{
  region: MapRegion;
  pts: [number, number][];
  markers: NonNullable<MapSpec["markers"]>;
  frame: number;
  fps: number;
  motion: "spring" | "linear" | "float";
  timing: SceneTiming;
}> = ({ region, pts, markers, frame, fps, motion, timing }) => {
  const o = springIn(frame, fps, resolveAnchor(timing, region.anchor, 0), motion);
  const fill = region.color ?? accentOf(0);
  if (!pts.length) return null;
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const label = region.label ?? region.name;
  const nearMarker = markers.some((m) => Math.hypot(m.x - cx, m.y - cy) < 60);
  const labelY = nearMarker ? cy - 40 : cy;
  return (
    <g opacity={o}>
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill={fill}
        fillOpacity={0.18}
        stroke={fill}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {label ? (
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={fill}
          fontSize={26}
          fontWeight={FW.bold}
          fontFamily={FONT}
          style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 5 }}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

function routeStyle(type: MapRoute["type"], dashed?: boolean): { width: number; dash: string | undefined } {
  if (type === "flight" || dashed) return { width: 3, dash: "10 10" };
  if (type === "road") return { width: 2.5, dash: undefined };
  return { width: 4, dash: undefined };
}

const RouteEl: React.FC<{
  route: MapRoute;
  markers: NonNullable<MapSpec["markers"]>;
  frame: number;
  fps: number;
  motion: "spring" | "linear" | "float";
  timing: SceneTiming;
}> = ({ route, markers, frame, fps, motion, timing }) => {
  const a = markers[route.from];
  const b = markers[route.to];
  if (!a || !b) return null;
  const color = route.color ?? accentOf(0);
  const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const animated = route.animated !== false;
  const o = springIn(frame, fps, resolveAnchor(timing, route.anchor, 0), motion);
  const len = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
  const drawFrames = Math.max(20, Math.round((len / 100) * 8));
  const progress = animated
    ? interpolate(
        frame,
        [resolveAnchor(timing, route.anchor, 0), resolveAnchor(timing, route.anchor, 0) + drawFrames],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  const drawOpacity = animated && frame < resolveAnchor(timing, route.anchor, 0) + drawFrames ? 1 : o;
  const flowX = interpolate(
    frame,
    [resolveAnchor(timing, route.anchor, 0), resolveAnchor(timing, route.anchor, 0) + drawFrames],
    [a.x, b.x],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const flowY = interpolate(
    frame,
    [resolveAnchor(timing, route.anchor, 0), resolveAnchor(timing, route.anchor, 0) + drawFrames],
    [a.y, b.y],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const flowOpacity = frame < resolveAnchor(timing, route.anchor, 0) + drawFrames ? 1 : 0;
  const { width, dash } = routeStyle(route.type, route.dashed);
  const finalDash = dash ?? strokeDasharray;

  return (
    <g>
      <path
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={finalDash}
        strokeDashoffset={strokeDashoffset}
        opacity={drawOpacity}
      />
      {route.flow !== false && animated ? (
        <circle
          r={route.type === "road" ? 3.5 : 5}
          fill={color}
          stroke="#fff"
          strokeWidth={1.5}
          cx={flowX}
          cy={flowY}
          opacity={flowOpacity}
        />
      ) : null}
    </g>
  );
};

const MarkerEl: React.FC<{
  marker: NonNullable<MapSpec["markers"]>[number];
  index: number;
  frame: number;
  fps: number;
  motion: "spring" | "linear" | "float";
  labelBelow: boolean;
  timing: SceneTiming;
}> = ({ marker, index, frame, fps, motion, labelBelow, timing }) => {
  const o = springIn(frame, fps, resolveAnchor(timing, marker.anchor, 0) + 10 + index * 12, motion);
  const color = marker.color ?? accentOf(index);
  const r = marker.size ?? 10;
  // 光晕半径是 r*2.2，原来标签只往外偏 r+12（=22px），正好压在自己的光晕上
  const labelY = labelBelow ? marker.y + r * 2.2 + 26 : marker.y - r * 2.2 - 26;
  return (
    <g opacity={o}>
      <circle cx={marker.x} cy={marker.y} r={r * 2.2} fill={color} fillOpacity={0.12} />
      <circle cx={marker.x} cy={marker.y} r={r * 1.5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />
      <circle cx={marker.x} cy={marker.y} r={r} fill={color} stroke="#fff" strokeWidth={2} />
      <text
        x={marker.x}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={C.ink}
        fontSize={30}
        fontWeight={FW.bold}
        fontFamily={FONT}
        style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 4 }}
      >
        {marker.name}
      </text>
    </g>
  );
};

const Legend: React.FC<{
  routes: MapRoute[];
  frame: number;
  fps: number;
  motion: "spring" | "linear" | "float";
  safe: { x: number; y: number; w: number; h: number };
  timing: SceneTiming;
}> = ({ routes, frame, fps, motion, safe, timing }) => {
  const o = springIn(frame, fps, resolveAnchor(timing, undefined, 0) + 40, motion);
  const types = Array.from(new Set(routes.map((r) => r.type ?? "rail")));
  const items = types.map((t) => ({
    t,
    label: t === "flight" ? "航线" : t === "road" ? "公路" : "高铁",
    dash: t === "flight" ? "10 10" : undefined,
    width: t === "road" ? 2.5 : t === "flight" ? 3 : 4,
  }));
  if (!items.length) return null;
  return (
    <g opacity={o} transform={`translate(${safe.x + safe.w - 220}, ${safe.y + safe.h - 70})`}>
      <rect
        x={-12}
        y={-14}
        width={232}
        height={items.length * 30 + 20}
        rx={12}
        fill="rgba(255,255,255,0.85)"
        stroke={accentOf(0)}
        strokeOpacity={0.1}
        strokeWidth={1}
      />
      {items.map((it, i) => (
        <g key={it.t} transform={`translate(0, ${i * 30})`}>
          <line
            x1={0}
            y1={0}
            x2={34}
            y2={0}
            stroke={accentOf(0)}
            strokeWidth={it.width}
            strokeLinecap="round"
            strokeDasharray={it.dash}
          />
          <text
            x={44}
            y={0}
            dominantBaseline="central"
            fill={C.ink}
            fontSize={18}
            fontWeight={FW.regular}
            fontFamily={FONT}
          >
            {it.label}
          </text>
        </g>
      ))}
    </g>
  );
};

export const MapScene: React.FC<SceneProps> = ({ page, subtitles, fps }) => {
  const f = useCurrentFrame();
  const { isPortrait, contentWidth, contentHeight } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionReserve = useCaptionReserve(
    subtitles,
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []),
  );
  const timing = useSceneTiming();
  const spec = page.map;
  const markers = spec?.markers ?? [];
  const routes = spec?.routes ?? [];
  const regions = spec?.regions ?? [];
  const regionPolys = useMemo(() => regions.map((r) => parsePolygon(r.points)), [regions]);
  const canvas = isPortrait ? { w: contentWidth, h: contentHeight } : CANVAS;
  /*
   * 竖屏底板高度按「内容包围盒」算，不再用一个拍出来的 0.62 纵横比。
   *
   * 之前的 `Math.max(520, (contentWidth - 96) * 0.62)` 与实际图形无关：3 个地标的
   * 散点云只占 ~240px 高，底板却给 500px，上下各空一条空底色（实测底板上空 100、
   * 下空 160）。这里先用内容包围盒反推图形放大后的实际高度，再加上地名需要的上下
   * 边距，底板就正好裹住图形。
   */
  const bounds = useMemo(
    () => computeMapBounds(spec ?? { markers: [], routes: [], regions: [] }, regionPolys),
    [spec, regionPolys],
  );
  const PORTRAIT_FIT_MAX = 1.1;
  const portraitBoard = useMemo(() => {
    const boardW = contentWidth - 120;
    const cW = Math.max(bounds.maxX - bounds.minX, 100);
    const cH = Math.max(bounds.maxY - bounds.minY, 100);
    // 与 computeFitTransform 用同一个放大上限，否则底板按 1.4 估、图形只放到 1.1
    const scale = Math.min((boardW - 220) / cW, PORTRAIT_FIT_MAX);
    // 上下各留 110：地名画在地标上方/下方 26px 处的 30px 字，再加一点余量
    const h = Math.round(cH * scale + 220);
    return { w: boardW, h: Math.min(Math.round(contentHeight - 96), Math.max(420, h)) };
  }, [bounds, contentWidth, contentHeight]);
  const portraitBoardH = portraitBoard.h;
  const safe = isPortrait
    ? {
        x: 60,
        // 底板在「标题底 .. 字幕条顶」之间居中，而不是在整张画布上居中（否则被字幕条往上顶）
        y: Math.round(contentTop + Math.max(0, (contentHeight - contentTop - captionReserve - portraitBoardH) / 2)),
        w: portraitBoard.w,
        h: portraitBoardH,
      }
    : SAFE;
  // 地名是「以地标为锚点向外偏移」画的，如果让地标铺满整个安全区，最外侧的地名就会
  // 正好压在遮罩边缘被切掉（竖屏实测「成都」「产品·上海」都缺字）。
  // 因此竖屏额外给地名留出 150px 边距，并压低放大上限，让图整体收进来一点。
  const fitBox = isPortrait
    ? { x: safe.x + 110, y: safe.y + 90, w: Math.max(200, safe.w - 220), h: Math.max(200, safe.h - 180) }
    : safe;
  const fit = useMemo(
    () => (spec ? computeFitTransform(spec, regionPolys, fitBox, isPortrait ? PORTRAIT_FIT_MAX : 1.35) : null),
    [spec, regionPolys, fitBox, isPortrait],
  );
  if (!spec || !fit) return null;
  const motion = page.motion ?? "spring";
  const { scale, tx, ty } = fit;

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={page.title} />
      <div style={{ flex: 1, position: "relative" }}>
        <svg width={canvas.w} height={canvas.h} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id="map-safe-mask">
              <rect x={0} y={0} width={canvas.w} height={canvas.h} fill="black" />
              <rect x={safe.x} y={safe.y} width={safe.w} height={safe.h} rx={24} fill="white" />
            </mask>
          </defs>
          {/* 地图底板：原来是纯白半透明 + 一道虚线内框，观感像"一块空画布"。
              改成主色极淡渐变 + 点阵网格，画面才有"地图"的体积感 */}
          <defs>
            <pattern id="map-grid" width={36} height={36} patternUnits="userSpaceOnUse">
              <circle cx={2} cy={2} r={1.6} fill={C.ink} fillOpacity={0.14} />
            </pattern>
            <linearGradient id="map-board" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.07} />
              <stop offset="55%" stopColor="rgba(255,255,255,0.62)" />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <rect
            x={safe.x}
            y={safe.y}
            width={safe.w}
            height={safe.h}
            rx={24}
            fill="url(#map-board)"
            stroke={accentOf(0)}
            strokeOpacity={0.1}
            strokeWidth={1.5}
          />
          <rect x={safe.x} y={safe.y} width={safe.w} height={safe.h} rx={24} fill="url(#map-grid)" stroke="none" />
          <g mask="url(#map-safe-mask)">
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              {regions.map((rg, i) => (
                <RegionEl
                  key={i}
                  region={rg}
                  pts={regionPolys[i] ?? []}
                  markers={markers}
                  frame={f}
                  fps={fps}
                  motion={motion}
                  timing={timing}
                />
              ))}
              {routes.map((rt, i) => (
                <RouteEl key={i} route={rt} markers={markers} frame={f} fps={fps} motion={motion} timing={timing} />
              ))}
              {markers.map((mk, i) => {
                const fitY = mk.y * scale + ty;
                const labelBelow = fitY < safe.y + 80;
                return (
                  <MarkerEl
                    key={i}
                    marker={mk}
                    index={i}
                    frame={f}
                    fps={fps}
                    motion={motion}
                    labelBelow={labelBelow}
                    timing={timing}
                  />
                );
              })}
            </g>
          </g>
          <Legend routes={routes} frame={f} fps={fps} motion={motion} safe={safe} timing={timing} />
        </svg>
        {/*
         * 竖屏：地图下方补齐「地标清单」。
         *
         * 这张地图的图形本身是扁的（3 个地标的包围盒纵横比 ≈0.3），竖屏把宽度用满后
         * 高度最多也就 270px 左右，剩下 1000+px 无论怎么放大都填不上——之前是靠给底板
         * 一个假高度硬撑，结果底板里空、底板外也空。这里把地标按顺序列出来，既填满
         * 竖向空间，也让"哪三个部门"一眼可读。
         */}
        {isPortrait && markers.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: safe.x,
              top: safe.y + safe.h + 36,
              width: safe.w,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 18,
              height: Math.max(
                0,
                Math.min(contentHeight - captionReserve - (safe.y + safe.h + 36) - 24, markers.length * 150),
              ),
            }}
          >
            {markers.map((mk, i) => {
              const at = resolveAnchor(timing, mk.anchor, i);
              const o = springIn(f, fps, at, motion);
              const col = mk.color ?? accentOf(i);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    padding: "18px 28px",
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.72)",
                    borderLeft: `6px solid ${col}`,
                    boxShadow: `0 8px 22px ${C.accentFaint}`,
                    opacity: o,
                    transform: `translateY(${interpolate(o, [0, 1], [24, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: col,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: FW.heavy,
                      fontFamily: FONT,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: FW.bold, color: C.ink, fontFamily: FONT }}>{mk.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
