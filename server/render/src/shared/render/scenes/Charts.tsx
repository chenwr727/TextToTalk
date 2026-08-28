import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, accentOf, springIn } from "../theme";
import type { SceneProps } from "./types";
import type { ChartSpec } from "../props";

export const ChartScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...values);
  const valueLabel = (v: number) => `${Math.round(v)}`;
  const n = values.length;
  const availW = 1920 - 160;
  const barGap = Math.max(24, Math.min(110, (availW - n * 60) / Math.max(1, n - 1)));
  const barW = Math.min(120, (availW - (n - 1) * barGap) / n);
  const labelFs = Math.min(FS.body, Math.max(16, barW));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 600, color: C.sub, fontFamily: FONT, opacity: 0.85, marginBottom: 70 }}>{title}</div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: barGap, height: 450, paddingBottom: 8 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, height: 4, borderRadius: 2, background: "linear-gradient(90deg, rgba(28,37,54,0.10), rgba(28,37,54,0.04))" }} />
        {values.map((v, i) => {
          const g = springIn(f, fps, i * 18, "spring");
          const h = (v / max) * 300;
          const a = accentOf(i);
          return (
            <div key={i} style={{ position: "relative", width: barW, height: 450 }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, textAlign: "center",
                fontSize: 30, fontWeight: 800, color: i === 0 ? C.sub : a, fontFamily: FONT,
              }}>
                {valueLabel(v)}
              </div>
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 90,
                height: `${h * g}px`,
                borderRadius: "14px 14px 0 0",
                background: i === 0 ? C.muted : `linear-gradient(180deg, ${a} 0%, ${a}cc 55%, ${a}88 100%)`,
                boxShadow: i === 0 ? "none" : `0 8px 20px ${a}47`,
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)" }} />
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: labelFs, fontWeight: 700, color: C.ink, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "visible" }}>{labels[i]}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const LineScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1180, H = 470, PAD = 110, BOTTOM = 70;
  const max = Math.max(...values) * 1.18 || 1;
  const n = values.length;
  const xs = values.map((_, i) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1));
  const ys = values.map((v) => (H - BOTTOM) - (v / max) * (H - PAD - BOTTOM));
  const grow = springIn(f, fps, 0, "spring");
  const last = Math.max(1, Math.round(grow * (n - 1)));
  const line = Array.from({ length: last + 1 }, (_, i) => `${xs[i]},${ys[i]}`).join(" ");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 22 }}>{title}</div>
      <svg width={W} height={H + 44}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={`g${t}`} x1={PAD} y1={H - BOTTOM - (H - PAD - BOTTOM) * t} x2={W - PAD} y2={H - BOTTOM - (H - PAD - BOTTOM) * t} stroke="#e3eaf6" strokeWidth={2} strokeDasharray="6 8" />
        ))}
        <line x1={PAD} y1={H - BOTTOM} x2={W - PAD} y2={H - BOTTOM} stroke="#cdd7e8" strokeWidth={3} />
        {values.map((_, i) => (
          <text key={`x${i}`} x={xs[i]} y={H + 32} textAnchor="middle" fontSize={30} fontWeight={700} fill={C.ink} fontFamily={FONT}>{labels[i]}</text>
        ))}
        {last > 0 && (
          <polygon
            points={`${xs[0]},${H - BOTTOM} ${line} ${xs[last]},${H - BOTTOM}`}
            fill="url(#lineAreaGrad)" opacity={0.5}
          />
        )}
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.4} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {last > 0 && <polyline points={line} fill="none" stroke={C.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />}
        {values.map((_, i) => (
          <g key={`d${i}`} opacity={i <= last ? 1 : 0}>
            <circle cx={xs[i]} cy={ys[i]} r={11} fill="#fff" stroke={C.accent} strokeWidth={6} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const pieSlicePath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
};

export const PieScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = [C.accent, "#6d91ff", "#34c79f", "#f2b03f", "#e868a4", C.muted];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const grow = springIn(f, fps, 0, "spring");
  const cx = 470, cy = 300, r = 200;
  const legendTop = Math.max(8, 260 - (values.length * 84) / 2);
  const fitLabel = (s: string) => (Array.from(s).length > 5 ? Array.from(s).slice(0, 5).join("") + "…" : s);
  let cumulative = 0;
  const slices = values.map((v, i) => {
    const pct = v / total;
    const a0 = -Math.PI / 2 + cumulative * 2 * Math.PI * grow;
    const a1 = -Math.PI / 2 + (cumulative + pct) * 2 * Math.PI * grow;
    cumulative += pct;
    return { d: pieSlicePath(cx, cy, r, a0, a1), color: pal[i % pal.length], pct: Math.round(pct * 100), label: labels[i] };
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 8 }}>{title}</div>
      <svg width={1100} height={520}>
        {slices.map((s, i) => (s.pct > 0 ? <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={4} opacity={0.95} /> : null))}
        <circle cx={cx} cy={cy} r={r * 0.42} fill="#fff" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={40} fontWeight={800} fill={C.ink} fontFamily={FONT}>100%</text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={26} fill={C.sub} fontFamily={FONT}>占比</text>
        {slices.map((s, i) => (
          <g key={`l${i}`}>
            <rect x={880} y={legendTop + i * 84} width={26} height={26} rx={6} fill={s.color} />
            <text x={918} y={legendTop + 20 + i * 84} fontSize={32} fontWeight={700} fill={C.ink} fontFamily={FONT}>{fitLabel(s.label)}</text>
            <text x={918} y={legendTop + 52 + i * 84} fontSize={30} fill={C.sub} fontFamily={FONT}>{s.pct}%</text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const AreaScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1180, H = 470, PAD = 110, BOTTOM = 70;
  const max = Math.max(...values) * 1.18 || 1;
  const n = values.length;
  const xs = values.map((_, i) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1));
  const ys = values.map((v) => (H - BOTTOM) - (v / max) * (H - PAD - BOTTOM));
  const grow = springIn(f, fps, 0, "spring");
  const last = Math.max(1, Math.round(grow * (n - 1)));
  const line = Array.from({ length: last + 1 }, (_, i) => `${xs[i]},${ys[i]}`).join(" ");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 22 }}>{title}</div>
      <svg width={W} height={H + 44}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={`g${t}`} x1={PAD} y1={H - BOTTOM - (H - PAD - BOTTOM) * t} x2={W - PAD} y2={H - BOTTOM - (H - PAD - BOTTOM) * t} stroke="#e3eaf6" strokeWidth={2} strokeDasharray="6 8" />
        ))}
        <line x1={PAD} y1={H - BOTTOM} x2={W - PAD} y2={H - BOTTOM} stroke="#cdd7e8" strokeWidth={3} />
        {values.map((_, i) => (
          <text key={`x${i}`} x={xs[i]} y={H + 32} textAnchor="middle" fontSize={30} fontWeight={700} fill={C.ink} fontFamily={FONT}>{labels[i]}</text>
        ))}
        {last > 0 && (
          <polygon points={`${xs[0]},${H - BOTTOM} ${line} ${xs[last]},${H - BOTTOM}`} fill="url(#areaGrad)" />
        )}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        {last > 0 && <polyline points={line} fill="none" stroke={C.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />}
        {values.map((_, i) => (
          <g key={`d${i}`} opacity={i <= last ? 1 : 0}>
            <circle cx={xs[i]} cy={ys[i]} r={11} fill="#fff" stroke={C.accent} strokeWidth={6} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const DonutScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values, total } = chart as { type: "donut"; labels: string[]; values: number[]; title: string; total?: number };
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = [C.accent, "#6d91ff", "#34c79f", "#f2b03f", "#e868a4", C.muted];
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const grow = springIn(f, fps, 0, "spring");
  const cx = 470, cy = 300, r = 200, hole = 0.55;
  const legendTop = Math.max(8, 260 - (values.length * 84) / 2);
  const fitLabel = (s: string) => (Array.from(s).length > 5 ? Array.from(s).slice(0, 5).join("") + "…" : s);
  let cumulative = 0;
  const slices = values.map((v, i) => {
    const pct = v / sum;
    const a0 = -Math.PI / 2 + cumulative * 2 * Math.PI * grow;
    const a1 = -Math.PI / 2 + (cumulative + pct) * 2 * Math.PI * grow;
    cumulative += pct;
    return { d: pieSlicePath(cx, cy, r, a0, a1), color: pal[i % pal.length], pct: Math.round(pct * 100), label: labels[i] };
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 8 }}>{title}</div>
      <svg width={1100} height={520}>
        {slices.map((s, i) => (s.pct > 0 ? <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={4} opacity={0.95} /> : null))}
        <circle cx={cx} cy={cy} r={r * hole} fill="#fff" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={44} fontWeight={800} fill={C.ink} fontFamily={FONT}>{total ?? sum}</text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={26} fill={C.sub} fontFamily={FONT}>总量</text>
        {slices.map((s, i) => (
          <g key={`l${i}`}>
            <rect x={880} y={legendTop + i * 84} width={26} height={26} rx={6} fill={s.color} />
            <text x={918} y={legendTop + 20 + i * 84} fontSize={32} fontWeight={700} fill={C.ink} fontFamily={FONT}>{fitLabel(s.label)}</text>
            <text x={918} y={legendTop + 52 + i * 84} fontSize={30} fill={C.sub} fontFamily={FONT}>{s.pct}%</text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const StackedBarScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, series } = chart as Extract<ChartSpec, { labels: string[]; series: { name: string; values: number[] }[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = [C.accent, "#6d91ff", "#34c79f", "#f2b03f"];
  const maxTotal = Math.max(...labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0))) || 1;
  const n = labels.length;
  const availW = 1920 - 160;
  const barGap = Math.max(24, Math.min(90, (availW - n * 60) / Math.max(1, n - 1)));
  const barW = Math.min(120, (availW - (n - 1) * barGap) / n);
  const labelFs = Math.min(FS.body, Math.max(16, barW));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 22 }}>{title}</div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: barGap, height: 360, paddingBottom: 8 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, height: 4, borderRadius: 2, background: "linear-gradient(90deg, rgba(28,37,54,0.10), rgba(28,37,54,0.04))" }} />
        {labels.map((label, i) => {
          const g = springIn(f, fps, i * 18, "spring");
          const totalH = (series.reduce((a, s) => a + (s.values[i] || 0), 0) / maxTotal) * 300;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column-reverse", width: barW, height: `${totalH * g}px`, borderRadius: "14px 14px 0 0", overflow: "hidden" }}>
                {series.map((s, si) => {
                  const segH = ((s.values[i] || 0) / maxTotal) * 300;
                  return (
                    <div key={si} style={{ width: "100%", height: `${segH}px`, background: pal[si % pal.length], boxShadow: si === series.length - 1 ? `0 8px 20px ${pal[si % pal.length]}47` : "none" }} />
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: labelFs, fontWeight: 700, color: C.ink, textAlign: "center", lineHeight: 1.2, maxWidth: barW + 16 }}>{label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: pal[i % pal.length] }} />
            <span style={{ fontSize: FS.body, fontWeight: 600, color: C.ink }}>{s.name}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const ScatterScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, points } = chart as Extract<ChartSpec, { points: { x: number; y: number; label?: string }[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1180, H = 520, PAD = 110, BOTTOM = 70;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
  const px = (x: number) => PAD + ((x - xMin) / xRange) * (W - PAD * 2);
  const py = (y: number) => (H - BOTTOM) - ((y - yMin) / yRange) * (H - PAD - BOTTOM);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontSize: FS.heading, fontWeight: 700, color: C.sub, fontFamily: FONT, marginBottom: 22 }}>{title}</div>
      <svg width={W} height={H + 44}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={`g${t}`} x1={PAD} y1={H - BOTTOM - (H - PAD - BOTTOM) * t} x2={W - PAD} y2={H - BOTTOM - (H - PAD - BOTTOM) * t} stroke="#e3eaf6" strokeWidth={2} strokeDasharray="6 8" />
        ))}
        <line x1={PAD} y1={H - BOTTOM} x2={W - PAD} y2={H - BOTTOM} stroke="#cdd7e8" strokeWidth={3} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - BOTTOM} stroke="#cdd7e8" strokeWidth={3} />
        {points.map((p, i) => {
          const o = springIn(f, fps, 20 + i * 12, "spring");
          return (
            <g key={i} opacity={o}>
              <circle cx={px(p.x)} cy={py(p.y)} r={16} fill={C.accent} fillOpacity={0.85} stroke="#fff" strokeWidth={4} />
              {p.label && <text x={px(p.x)} y={py(p.y) - 24} textAnchor="middle" fontSize={26} fontWeight={700} fill={C.ink} fontFamily={FONT}>{p.label}</text>}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
