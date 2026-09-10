import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, FONT, springIn, accentOf } from "../theme";
import { PageHeading } from "../PageHeading";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";
import type { MapSpec, MapRoute, MapRegion } from "../props";

const CANVAS = { w: 1920, h: 1080 };
const SAFE = { x: 80, y: 240, w: 1760, h: 540 };

function parsePolygon(points: string): [number, number][] {
  return points.split(/\s+/).map((p) => p.split(",").map(Number) as [number, number]).filter((p) => p.length === 2 && p.every(Number.isFinite));
}

function computeMapBounds(spec: MapSpec, regionPolys: [number, number][][]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const markers = spec.markers ?? [];

  for (const m of markers) {
    xs.push(m.x); ys.push(m.y);
  }
  for (const poly of regionPolys) {
    for (const [px, py] of poly) {
      xs.push(px); ys.push(py);
    }
  }
  if (!xs.length) return { minX: 0, minY: 0, maxX: CANVAS.w, maxY: CANVAS.h };
  const minX = xs.reduce((a, v) => Math.min(a, v), Infinity);
  const minY = ys.reduce((a, v) => Math.min(a, v), Infinity);
  const maxX = xs.reduce((a, v) => Math.max(a, v), -Infinity);
  const maxY = ys.reduce((a, v) => Math.max(a, v), -Infinity);
  return { minX, minY, maxX, maxY };
}

function computeFitTransform(spec: MapSpec, regionPolys: [number, number][][], safe: { x: number; y: number; w: number; h: number }): { scale: number; tx: number; ty: number } {
  const b = computeMapBounds(spec, regionPolys);
  const contentW = Math.max(b.maxX - b.minX, 100);
  const contentH = Math.max(b.maxY - b.minY, 100);
  const scaleX = safe.w / contentW;
  const scaleY = safe.h / contentH;
  const scale = Math.min(scaleX, scaleY, 1.35);

  const fitW = contentW * scale;
  const fitH = contentH * scale;
  const tx = safe.x + (safe.w - fitW) / 2 - b.minX * scale;
  const ty = safe.y + (safe.h - fitH) / 2 - b.minY * scale;
  return { scale, tx, ty };
}

const RegionEl: React.FC<{ region: MapRegion; pts: [number, number][]; markers: NonNullable<MapSpec["markers"]>; frame: number; fps: number; motion: "spring" | "linear" | "float" }> = ({ region, pts, markers, frame, fps, motion }) => {
  const o = springIn(frame, fps, 0, motion);
  const fill = region.color ?? accentOf(0);
  if (!pts.length) return null;
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const label = region.label ?? region.name;
  const nearMarker = markers.some((m) => Math.hypot(m.x - cx, m.y - cy) < 60);
  const labelY = nearMarker ? cy - 40 : cy;
  return (
    <g opacity={o}>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} strokeLinejoin="round" />
      {label ? (
        <text x={cx} y={labelY} textAnchor="middle" dominantBaseline="central" fill={fill} fontSize={26} fontWeight={700} fontFamily={FONT}
          style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 5 }}>
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

const RouteEl: React.FC<{ route: MapRoute; markers: NonNullable<MapSpec["markers"]>; frame: number; fps: number; motion: "spring" | "linear" | "float" }> = ({ route, markers, frame, fps, motion }) => {
  const a = markers[route.from];
  const b = markers[route.to];
  if (!a || !b) return null;
  const color = route.color ?? accentOf(0);
  const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const animated = route.animated !== false;
  const o = springIn(frame, fps, 0, motion);
  const len = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
  const drawFrames = Math.max(20, Math.round(len / 100 * 8));
  const progress = animated
    ? interpolate(frame, [0, drawFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  const drawOpacity = animated && frame < drawFrames ? 1 : o;
  const flowX = interpolate(frame, [0, drawFrames], [a.x, b.x], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flowY = interpolate(frame, [0, drawFrames], [a.y, b.y], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flowOpacity = frame < drawFrames ? 1 : 0;
  const { width, dash } = routeStyle(route.type, route.dashed);
  const finalDash = dash ?? strokeDasharray;

  return (
    <g>
      <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={finalDash}
        strokeDashoffset={strokeDashoffset}
        opacity={drawOpacity} />
      {route.flow !== false && animated ? (
        <circle r={route.type === "road" ? 3.5 : 5} fill={color} stroke="#fff" strokeWidth={1.5}
          cx={flowX} cy={flowY} opacity={flowOpacity} />
      ) : null}
    </g>
  );
};

const MarkerEl: React.FC<{ marker: NonNullable<MapSpec["markers"]>[number]; index: number; frame: number; fps: number; motion: "spring" | "linear" | "float"; labelBelow: boolean }> = ({ marker, index, frame, fps, motion, labelBelow }) => {
  const o = springIn(frame, fps, 10 + index * 12, motion);
  const color = marker.color ?? accentOf(index);
  const r = marker.size ?? 10;
  const labelY = labelBelow ? marker.y + r + 20 : marker.y - r - 12;
  return (
    <g opacity={o}>
      <circle cx={marker.x} cy={marker.y} r={r * 2.2} fill={color} fillOpacity={0.12} />
      <circle cx={marker.x} cy={marker.y} r={r * 1.5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />
      <circle cx={marker.x} cy={marker.y} r={r} fill={color} stroke="#fff" strokeWidth={2} />
      <text x={marker.x} y={labelY} textAnchor="middle" dominantBaseline="central"
        fill={C.ink} fontSize={24} fontWeight={700} fontFamily={FONT}
        style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 4 }}>
        {marker.name}
      </text>
    </g>
  );
};

const Legend: React.FC<{ routes: MapRoute[]; frame: number; fps: number; motion: "spring" | "linear" | "float"; safe: { x: number; y: number; w: number; h: number } }> = ({ routes, frame, fps, motion, safe }) => {
  const o = springIn(frame, fps, 40, motion);
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
      <rect x={-12} y={-14} width={232} height={items.length * 30 + 20} rx={12}
        fill="rgba(255,255,255,0.85)" stroke="rgba(28,37,54,0.10)" strokeWidth={1} />
      {items.map((it, i) => (
        <g key={it.t} transform={`translate(0, ${i * 30})`}>
          <line x1={0} y1={0} x2={34} y2={0} stroke={C.ink} strokeWidth={it.width} strokeLinecap="round" strokeDasharray={it.dash} />
          <text x={44} y={0} dominantBaseline="central" fill={C.ink} fontSize={18} fontWeight={600} fontFamily={FONT}>
            {it.label}
          </text>
        </g>
      ))}
    </g>
  );
};

export const MapScene: React.FC<SceneProps> = ({ page, fps }) => {
  const f = useCurrentFrame();
  const { isPortrait, contentWidth, contentHeight } = useResponsive();
  const spec = page.map;
  const markers = spec?.markers ?? [];
  const routes = spec?.routes ?? [];
  const regions = spec?.regions ?? [];
  const regionPolys = useMemo(() => regions.map((r) => parsePolygon(r.points)), [regions]);
  const canvas = isPortrait ? { w: contentWidth, h: contentHeight } : CANVAS;
  const safe = isPortrait ? { x: 0, y: 0, w: contentWidth, h: contentHeight } : SAFE;
  const fit = useMemo(() => (spec ? computeFitTransform(spec, regionPolys, safe) : null), [spec, regionPolys, safe]);
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
          <rect x={safe.x} y={safe.y} width={safe.w} height={safe.h} rx={24}
            fill="rgba(255,255,255,0.55)" stroke="rgba(28,37,54,0.10)" strokeWidth={1.5} />
          <rect x={safe.x + 10} y={safe.y + 10} width={safe.w - 20} height={safe.h - 20} rx={18}
            fill="none" stroke="rgba(28,37,54,0.08)" strokeWidth={1.5} strokeDasharray="8 8" />
          <g mask="url(#map-safe-mask)">
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              {regions.map((rg, i) => (
                <RegionEl key={i} region={rg} pts={regionPolys[i] ?? []} markers={markers} frame={f} fps={fps} motion={motion} />
              ))}
              {routes.map((rt, i) => (
                <RouteEl key={i} route={rt} markers={markers} frame={f} fps={fps} motion={motion} />
              ))}
              {markers.map((mk, i) => {
                const fitY = mk.y * scale + ty;
                const labelBelow = fitY < safe.y + 80;
                return <MarkerEl key={i} marker={mk} index={i} frame={f} fps={fps} motion={motion} labelBelow={labelBelow} />;
              })}
            </g>
          </g>
          <Legend routes={routes} frame={f} fps={fps} motion={motion} safe={safe} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};