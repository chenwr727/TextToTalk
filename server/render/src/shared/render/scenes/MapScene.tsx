import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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
  const { height: canvasH } = useVideoConfig();
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
  /*
   * 竖屏底板只裹住图形（不用假高度硬撑）。
   *
   * 试过四种填法，结论：剩下的高度**不能靠分空白消化**。
   *   ① 底板拉高到 795 → 空底板（图形上下各 约260px 纯底色），fill 73%；
   *   ② 卡片自然高 + `space-between` → 三张卡孤零零散着（卡间 380px）；
   *   ③ 卡片 `flex: 1` 只装一行字 → 空面板；
   *   ④（现在）给卡片加**第二行：它与哪些地标相连**（从 routes 推出来，不是造数据），
   *      卡片长高才有内容支撑。
   */
  const portraitBoard = useMemo(() => {
    const boardW = contentWidth - 120;
    const cW = Math.max(bounds.maxX - bounds.minX, 100);
    const cH = Math.max(bounds.maxY - bounds.minY, 100);
    // 与 computeFitTransform 用同一个放大上限，否则底板按 1.4 估、图形只放到 1.1
    const scale = Math.min((boardW - 220) / cW, PORTRAIT_FIT_MAX);
    // 上下各留 110：地名画在地标上方/下方 26px 处的 30px 字，再加一点余量
    const hugH = Math.round(cH * scale + 220);
    const h = Math.min(Math.round(contentHeight - 96), Math.max(420, hugH));
    return { w: boardW, h };
  }, [bounds, contentWidth, contentHeight]);
  const portraitBoardH = portraitBoard.h;
  /*
   * 每个地标的「连线」说明，从 routes 里推出来（不造数据）。
   *
   * 这一页只有 3 个地标、每个只有名字，卡片拉高就是空面板；
   * 而连线本来就在数据里，写成「→ 研发 · 杭州」既填了卡片又省得观众去图上数线。
   */
  const links = useMemo(
    () =>
      markers.map((_, i) => {
        const parts: string[] = [];
        for (const rt of routes) {
          const other = rt.from === i ? rt.to : rt.to === i ? rt.from : -1;
          if (other >= 0 && markers[other]) {
            const name = markers[other].name;
            if (!parts.includes(name)) parts.push(name);
          }
        }
        return parts.length ? `\u2192 ${parts.join("\u3001")}` : "";
      }),
    [markers, routes],
  );
  /*
   * 正文带底：与体检、问答页同一个口径（画布 88% 与字幕实测高度取较小）。
   */
  const bandBottom = isPortrait
    ? Math.min(Math.round(canvasH * 0.88), canvasH - Math.max(captionReserve, 120))
    : Math.round(canvasH * 0.852);
  /*
   * 横屏也要给地标清单留位。
   *
   * 原来这块清单整块被 `isPortrait` 关掉，横屏只有底图：图上有地名，
   * 但看不出「哪几个部门、怎么串起来」。现在先算清单高（每行 86 + 间隔 12），
   * 剩下的给底板；一个地标都没时行为与改动前一致。
   */
  /*
   * 横屏卡片的实测高是 102px（font 34 + 行高 + 上下 padding 18×2 + 边框）。
   * 先前按 86 估，3 张卡溢出 25px，第 3 张的底边直接压在字幕上沿（看图才发现）。
   */
  const LAND_ROW = 102;
  const LAND_GAP = 12;
  const landListH =
    markers.length > 0 ? Math.min(320, markers.length * LAND_ROW + Math.max(0, markers.length - 1) * LAND_GAP) : 0;
  const landBoardH = Math.max(300, bandBottom - SAFE.y - landListH - (landListH > 0 ? 24 : 0));
  const safe = isPortrait
    ? {
        x: 60,
        /*
         * 底板直接贴着标题下沿起笔。
         *
         * 原来在「标题底..字幕顶」之间居中，而整块内容（底板 490 + 卡片 450）
         * 只有 854px：实测标题下空 494px、带底空 166px，fill 52%。
         * 现在底板顶在正文带顶，剩下的高度给地标清单；卡片各自长高吃掉它，不拉大间隙。
         */
        y: Math.round(contentTop),
        w: portraitBoard.w,
        h: portraitBoardH,
      }
    : { ...SAFE, h: landBoardH };
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
        {markers.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: safe.x,
              top: safe.y + safe.h + (isPortrait ? 36 : 24),
              width: safe.w,
              display: "flex",
              flexDirection: "column",
              /* 横屏卡片自然高：用 space-between 在算好的清单高里均匀分布；竖屏卡片自己长高 */
              justifyContent: isPortrait ? "flex-start" : "space-between",
              gap: 26,
              /*
               * 竖屏：清单拉到正文带底，卡片自己分掉剩余高度。
               *
               * 横屏必须保留原来的算式：横屏底板是固定 SAFE（y 240 / h 540），
               * 拿“带底 920 - 816”只剩 104px，3 张卡被压成 17px 高——实测直接看不见，
               * 而体检仍报 72% / 0 告警（几何看不出卡片被压扁）。
               */
              /* 横屏不渲染这块清单（见下方 isPortrait 条件），这里只算竖屏 */
              height: Math.max(0, isPortrait ? bandBottom - (safe.y + safe.h + 36) : landListH),
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
                    flex: isPortrait ? 1 : undefined,
                    padding: isPortrait ? "18px 30px" : "18px 28px",
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <div style={{ fontSize: 34, fontWeight: FW.bold, color: C.ink, fontFamily: FONT }}>{mk.name}</div>
                    {/*
                     * 连线行只在竖屏出现。
                     *
                     * 它本来就是为了给竖屏的空卡片一点内容支撑；
                     * 横屏卡片是紧凑行（高 约84），多一行就从 84 涨到 126，
                     * 3 张就超出清单高、第 3 张直接被字幕条压住（实测正是如此）。
                     */}
                    {isPortrait && links[i] ? (
                      <div style={{ fontSize: 24, color: C.sub, fontFamily: FONT, lineHeight: 1.3 }}>{links[i]}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
