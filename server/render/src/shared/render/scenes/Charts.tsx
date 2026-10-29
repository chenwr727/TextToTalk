import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FS, FW, accentOf, tileShadow, springIn } from "../theme";
import { useResponsive } from "../responsive";
import { axisScale, fmtTick, niceStep, unitOf, yAxisOf } from "../chartScale";
import { useSceneTiming } from "../captionTiming";
import { HeadingContent } from "../PageHeading";
import type { SceneProps } from "./types";
import type { ChartSpec } from "../props";

/**
 * 多系列配色。
 *
 * 曾经是写死的 `[C.accent, "#6d91ff", "#34c79f", "#f2b03f", "#e868a4", C.muted]`，
 * 其中那四个十六进制正是 tech 主题调色板的副本 —— 于是饼图/环图/堆叠图在
 * business、warm、dark 主题下依然是科技蓝紫，换主题只有柱子外框跟着变。
 * 现在走 accentOf，跟随主题的 --ttt-a{i}。
 */
const SERIES = [accentOf(0), accentOf(1), accentOf(2), accentOf(3), accentOf(4), accentOf(5)];

/**
 * 图表页标题。
 *
 * 页面标题（page.title）走主题的标题语言，与其它版式一致；chart.title 降为副标题，
 * 保留"这组数据在比什么"的信息。放在内容列的流里而不是绝对定位，否则会压住图形。
 */
const ChartHeading: React.FC<{ page: SceneProps["page"]; chartTitle?: string }> = ({ page, chartTitle }) => {
  const { isPortrait, sp } = useResponsive();
  const head = String(page?.title ?? "").trim();
  const sub = String(chartTitle ?? "").trim();
  // 单位：规格里没有独立字段，只能从标题里认（见 unitOf）。认出来就标在副标题后面，
  // 让刻度不是裸数字；认不出（括号里是"2021-2023"这类说明）就什么都不加
  const unit = unitOf(sub) ?? unitOf(head);
  if (!head && !sub) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: isPortrait ? sp(30) : 30,
      }}
    >
      <HeadingContent text={head || sub} inline />
      {head && sub && sub !== head ? (
        <div
          style={{
            // 竖屏副标题原来距装饰线 sp(12)≈10px，像挤在标题下面
            marginTop: isPortrait ? sp(26) : 12,
            fontSize: isPortrait ? sp(24) : FS.label,
            fontWeight: FW.regular,
            color: C.sub,
            fontFamily: FONT,
            opacity: 0.9,
          }}
        >
          {sub}
          {unit && !sub.includes(unit) ? <span style={{ opacity: 0.75 }}>{` ｜ 单位：${unit}`}</span> : null}
        </div>
      ) : null}
    </div>
  );
};
export const ChartScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const dataMax = Math.max(...values);
  const { top: axisTop, ticks } = axisScale(dataMax);
  const max = axisTop;
  const valueLabel = (v: number) => `${Math.round(v)}`;
  const n = values.length;
  const availW = isPortrait ? contentWidth : 1920 - 160;
  const barGap = Math.max(
    isPortrait ? sp(24) : 24,
    Math.min(isPortrait ? sp(110) : 180, (availW - n * (isPortrait ? sp(60) : 60)) / Math.max(1, n - 1)),
  );
  const barW = Math.min(isPortrait ? 220 : 200, (availW - (n - 1) * barGap) / n);
  const labelFs = Math.min(isPortrait ? fs(FS.body) : FS.body, Math.max(16, barW));
  const chartH = isPortrait ? 880 : 500;
  const barMaxH = isPortrait ? 700 : 380;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <ChartHeading page={page} chartTitle={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: barGap,
          height: chartH,
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: isPortrait ? sp(90) : 90,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${alpha(C.ink, 10)}, ${alpha(C.ink, 4)})`,
          }}
        />
        {/* Y 轴：刻度线 + 数值。柱区底边在 bottom:90，绘图高 barMaxH，与刻度同一套比例 */}
        {ticks.map((t) => (
          <div
            key={`t${t.value}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: (isPortrait ? sp(90) : 90) + t.ratio * barMaxH - 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background: alpha(C.ink, t.ratio === 0 ? 14 : 7),
              }}
            />
            <div
              style={{
                position: "absolute",
                right: "100%",
                marginRight: isPortrait ? sp(12) : 12,
                transform: "translateY(-50%)",
                // 横屏原来是 FS.small=20（画布宽 1%），同图分类标签却 36px，差 2.3 倍
                fontSize: isPortrait ? PORTRAIT_TICK_FS : 26,
                color: C.sub,
                fontFamily: FONT,
                fontWeight: FW.regular,
                whiteSpace: "nowrap",
              }}
            >
              {fmtTick(t.value)}
            </div>
          </div>
        ))}
        {values.map((v, i) => {
          /*
           * 柱子不跟字幕走。
           *
           * 原来用 timing.frameAt(i, 0, 18)：第 i 根柱等第 i 句字幕开讲。
           * 实测（2 根柱 / 2 句字幕）：第二根要等到第二句字幕（约 4.5s）才开始长，
           * t=13s 只长到 17%，几乎看不见，只剩一个「24」数字漂在基线上——
           * 整张图读起来像「第二个数据缺失/为 0」。一张图是一个数据单元，
           * 应该整体入场：统一从本页起笔，只做 7 帧微错开；顺便尊重 page.motion。
           */
          const g = springIn(f, fps, 4 + i * 7, page.motion);
          const h = (v / max) * barMaxH;
          const a = accentOf(i);
          return (
            <div key={i} style={{ position: "relative", width: barW, height: chartH }}>
              {/* 数值标签跟着柱顶走：此前钉在列容器顶端，矮柱的数字会飘在半空中，读不出对应关系 */}
              <div
                style={{
                  position: "absolute",
                  bottom: (isPortrait ? sp(90) : 90) + h * g + 12,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: isPortrait ? PORTRAIT_VALUE_FS : FS.caption,
                  fontWeight: FW.heavy,
                  color: a,
                  fontFamily: FONT,
                }}
              >
                {valueLabel(v)}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: isPortrait ? sp(90) : 90,
                  height: `${h * g}px`,
                  borderRadius: "14px 14px 0 0",
                  // 此前第一根柱子被刻意画成灰色（C.muted）、不带投影，看起来像"数据缺失"。
                  // 现在所有柱子统一走主色阶，最大值那根额外加投影做视觉锚点
                  background: `linear-gradient(180deg, ${a} 0%, ${alpha(a, 80)} 55%, ${alpha(a, 53)} 100%)`,
                  boxShadow: v === max ? tileShadow(a) : "none",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "40%",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)",
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  fontSize: labelFs,
                  fontWeight: 700,
                  color: C.ink,
                  fontFamily: FONT,
                  textAlign: "center",
                  lineHeight: 1.2,
                  whiteSpace: barW < 60 ? "normal" : "nowrap",
                  overflow: "visible",
                }}
              >
                {labels[i]}
              </div>
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
  const { isPortrait, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const W = isPortrait ? contentWidth : 1500,
    // 560 会让 x 轴标签贴到字幕条（实测只剩 11px），520 配 PAD_T 仍然把绘图区从 325 抬到 410
    H = isPortrait ? 900 : 520,
    PAD = isPortrait ? sp(110) : 110,
    BOTTOM = isPortrait ? sp(70) : 70;
  /*
   * PAD 原来同时当左右内边距和**顶部内边距**用（ys 里写的是 H-PAD-BOTTOM），
   * 于是 SVG 顶部那 110px 永远是空的：绘图区只占画布 30%，
   * 标题下沿到最高网格线之间空出 200px 纯白。顶部内边距单独给一个小值。
   */
  const PAD_T = isPortrait ? sp(60) : 40;
  const { max, ticks: yTicks } = yAxisOf(Math.max(...values) || 1, H - PAD_T - BOTTOM, H - BOTTOM);
  const n = values.length;
  const xs = values.map((_, i) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1));
  const ys = values.map((v) => H - BOTTOM - (v / max) * (H - PAD_T - BOTTOM));
  const grow = springIn(f, fps, timing.frameAt(0), "spring");
  const last = Math.max(1, Math.round(grow * (n - 1)));
  const line = Array.from({ length: last + 1 }, (_, i) => `${xs[i]},${ys[i]}`).join(" ");
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        // 整组上移：居中的画布里 x 轴标签离字幕条只剩 17px（H=520 时实测）
        paddingBottom: isPortrait ? 0 : 88,
      }}
    >
      <ChartHeading page={page} chartTitle={title} />
      <svg width={W} height={H + (isPortrait ? sp(44) : 44)}>
        {yTicks.map((t) => (
          <g key={`g${t.value}`}>
            <line
              x1={PAD}
              y1={t.y}
              x2={W - PAD}
              y2={t.y}
              stroke={C.ink}
              strokeOpacity={t.value === 0 ? 0.16 : 0.08}
              strokeWidth={t.value === 0 ? 3 : 2}
              strokeDasharray={t.value === 0 ? undefined : "6 8"}
            />
            <text
              x={PAD - (isPortrait ? sp(16) : 16)}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={isPortrait ? PORTRAIT_TICK_FS : LAND_TICK_FS}
              fill={C.sub}
              fontFamily={FONT}
            >
              {fmtTick(t.value)}
            </text>
          </g>
        ))}
        {values.map((_, i) => (
          <text
            key={`x${i}`}
            x={xs[i]}
            y={H + (isPortrait ? sp(32) : 32)}
            textAnchor="middle"
            fontSize={isPortrait ? PORTRAIT_LABEL_FS : 30}
            fontWeight={FW.bold}
            fill={C.ink}
            fontFamily={FONT}
          >
            {labels[i]}
          </text>
        ))}
        {last > 0 && (
          <polygon
            points={`${xs[0]},${H - BOTTOM} ${line} ${xs[last]},${H - BOTTOM}`}
            fill="url(#lineAreaGrad)"
            opacity={0.5}
          />
        )}
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.4} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {last > 0 && (
          <polyline
            points={line}
            fill="none"
            stroke={C.accent}
            strokeWidth={isPortrait ? sp(8) : 8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {values.map((_, i) => (
          <g key={`d${i}`} opacity={i <= last ? 1 : 0}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={isPortrait ? sp(11) : 11}
              fill="#fff"
              stroke={C.accent}
              strokeWidth={isPortrait ? sp(6) : 6}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * 竖屏图表的字号不走 `fs()` 的整体缩放。
 *
 * `fs(n)` 在竖屏是 ×0.82——那是为"卡片里的正文"定的，但画布宽度也从 1920 掉到 1080，
 * 两边一乘，刻度标签只剩 16px（占画布宽 1.5%），手机全屏看根本读不出来。
 * 图表里的刻度/数值/图例按"占画布宽的比例"重新给一套。
 */
/**
 * 横屏图表刻度字号。
 *
 * 原来用 FS.small(=20)，占画布宽 1%：同一张图里分类标签是 36px，两者差 2.3 倍，
 * 手机上根本读不出刻度值。提到 26 之后与标签的比例回到 1.4 倍以内。
 */
const LAND_TICK_FS = 26;

const PORTRAIT_TICK_FS = 26;
const PORTRAIT_VALUE_FS = 34;
const PORTRAIT_LABEL_FS = 32;
const PORTRAIT_LEGEND_FS = 30;
const pieSlicePath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const x0 = cx + r * Math.cos(a0),
    y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1),
    y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
};

export const PieScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const pal = SERIES;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const grow = springIn(f, fps, timing.frameAt(0), "spring");
  const cx = isPortrait ? contentWidth / 2 : 430,
    cy = isPortrait ? 360 : 300,
    r = isPortrait ? 300 : 250;
  const fitLabel = (s: string) => (Array.from(s).length > 5 ? Array.from(s).slice(0, 5).join("") + "…" : s);
  let cumulative = 0;
  const slices = values.map((v, i) => {
    const pct = v / total;
    const a0 = -Math.PI / 2 + cumulative * 2 * Math.PI * grow;
    const a1 = -Math.PI / 2 + (cumulative + pct) * 2 * Math.PI * grow;
    cumulative += pct;
    return {
      d: pieSlicePath(cx, cy, r, a0, a1),
      color: pal[i % pal.length],
      pct: Math.round(pct * 100),
      label: labels[i],
      mid: (a0 + a1) / 2,
    };
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <ChartHeading page={page} chartTitle={title} />
      <svg width={isPortrait ? contentWidth : 1150} height={isPortrait ? 760 : 560}>
        {slices.map((s, i) =>
          s.pct > 0 ? <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={4} opacity={0.95} /> : null,
        )}
        {/*
          真饼图：原来这里有一块 `r * 0.42` 的白色中心圆 + 两行中心文字，
          于是"饼图"其实也是个环形（孔洞直径 42%，与 donut 的 55% 几乎分不出来）。
          去掉中心圆，百分比直接标在扇区内 0.62r 处，两个版式才各司其职。
        */}
        {slices.map((s, i) =>
          s.pct >= 8 ? (
            <text
              key={`p${i}`}
              x={cx + r * 0.62 * Math.cos(s.mid)}
              y={cy + r * 0.62 * Math.sin(s.mid)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isPortrait ? fs(32) : 30}
              fontWeight={FW.heavy}
              fill="#fff"
              fontFamily={FONT}
              opacity={0.95}
            >
              {s.pct}%
            </text>
          ) : null,
        )}
        {!isPortrait &&
          slices.map((s, i) => {
            const legendTop = Math.max(8, 280 - (values.length * 84) / 2);
            return (
              <g key={`l${i}`}>
                <rect x={740} y={legendTop + i * 84} width={26} height={26} rx={6} fill={s.color} />
                <text
                  x={778}
                  y={legendTop + 20 + i * 84}
                  fontSize={32}
                  fontWeight={FW.bold}
                  fill={C.ink}
                  fontFamily={FONT}
                >
                  {fitLabel(s.label)}
                </text>
                <text x={778} y={legendTop + 52 + i * 84} fontSize={30} fill={C.sub} fontFamily={FONT}>
                  {s.pct}%
                </text>
              </g>
            );
          })}
      </svg>
      {isPortrait && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: sp(16),
            rowGap: sp(10),
            marginTop: sp(16),
            maxWidth: contentWidth,
          }}
        >
          {slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: sp(8) }}>
              <div style={{ width: sp(18), height: sp(18), borderRadius: 4, background: s.color }} />
              <span style={{ fontSize: fs(FS.body), fontWeight: FW.regular, color: C.ink }}>{fitLabel(s.label)}</span>
              <span style={{ fontSize: fs(FS.body), fontWeight: 700, color: C.sub }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const AreaScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values } = chart as Extract<ChartSpec, { labels: string[]; values: number[] }>;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const W = isPortrait ? contentWidth : 1500,
    // 560 会让 x 轴标签贴到字幕条（实测只剩 11px），520 配 PAD_T 仍然把绘图区从 325 抬到 410
    H = isPortrait ? 900 : 520,
    PAD = isPortrait ? sp(110) : 110,
    BOTTOM = isPortrait ? sp(70) : 70;
  /*
   * PAD 原来同时当左右内边距和**顶部内边距**用（ys 里写的是 H-PAD-BOTTOM），
   * 于是 SVG 顶部那 110px 永远是空的：绘图区只占画布 30%，
   * 标题下沿到最高网格线之间空出 200px 纯白。顶部内边距单独给一个小值。
   */
  const PAD_T = isPortrait ? sp(60) : 40;
  const { max, ticks: yTicks } = yAxisOf(Math.max(...values) || 1, H - PAD_T - BOTTOM, H - BOTTOM);
  const n = values.length;
  const xs = values.map((_, i) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1));
  const ys = values.map((v) => H - BOTTOM - (v / max) * (H - PAD_T - BOTTOM));
  const grow = springIn(f, fps, timing.frameAt(0), "spring");
  const last = Math.max(1, Math.round(grow * (n - 1)));
  const line = Array.from({ length: last + 1 }, (_, i) => `${xs[i]},${ys[i]}`).join(" ");
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        // 整组上移：居中的画布里 x 轴标签离字幕条只剩 17px（H=520 时实测）
        paddingBottom: isPortrait ? 0 : 88,
      }}
    >
      <ChartHeading page={page} chartTitle={title} />
      <svg width={W} height={H + (isPortrait ? sp(44) : 44)}>
        {yTicks.map((t) => (
          <g key={`g${t.value}`}>
            <line
              x1={PAD}
              y1={t.y}
              x2={W - PAD}
              y2={t.y}
              stroke={C.ink}
              strokeOpacity={t.value === 0 ? 0.16 : 0.08}
              strokeWidth={t.value === 0 ? 3 : 2}
              strokeDasharray={t.value === 0 ? undefined : "6 8"}
            />
            <text
              x={PAD - (isPortrait ? sp(16) : 16)}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={isPortrait ? PORTRAIT_TICK_FS : LAND_TICK_FS}
              fill={C.sub}
              fontFamily={FONT}
            >
              {fmtTick(t.value)}
            </text>
          </g>
        ))}
        {values.map((_, i) => (
          <text
            key={`x${i}`}
            x={xs[i]}
            y={H + (isPortrait ? sp(32) : 32)}
            textAnchor="middle"
            fontSize={isPortrait ? PORTRAIT_LABEL_FS : 30}
            fontWeight={FW.bold}
            fill={C.ink}
            fontFamily={FONT}
          >
            {labels[i]}
          </text>
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
        {last > 0 && (
          <polyline
            points={line}
            fill="none"
            stroke={C.accent}
            strokeWidth={isPortrait ? sp(8) : 8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {values.map((_, i) => (
          <g key={`d${i}`} opacity={i <= last ? 1 : 0}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={isPortrait ? sp(11) : 11}
              fill="#fff"
              stroke={C.accent}
              strokeWidth={isPortrait ? sp(6) : 6}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const DonutScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, values, total } = chart as {
    type: "donut";
    labels: string[];
    values: number[];
    title: string;
    total?: number;
  };
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const pal = SERIES;
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const grow = springIn(f, fps, timing.frameAt(0), "spring");
  const cx = isPortrait ? contentWidth / 2 : 430,
    cy = isPortrait ? 360 : 300,
    r = isPortrait ? 300 : 250,
    hole = 0.55;
  const fitLabel = (s: string) => (Array.from(s).length > 5 ? Array.from(s).slice(0, 5).join("") + "…" : s);
  let cumulative = 0;
  const slices = values.map((v, i) => {
    const pct = v / sum;
    const a0 = -Math.PI / 2 + cumulative * 2 * Math.PI * grow;
    const a1 = -Math.PI / 2 + (cumulative + pct) * 2 * Math.PI * grow;
    cumulative += pct;
    return {
      d: pieSlicePath(cx, cy, r, a0, a1),
      color: pal[i % pal.length],
      pct: Math.round(pct * 100),
      label: labels[i],
    };
  });
  /*
   * 中心文案：给了 total 就显示它（"一次审批 4.2 天"这类），否则看数据本身——
   * 若各值加起来正好是 100，说明它们本来就是百分比，此时显示"总量 100"是废话，
   * 改为显示占比最大的那一项；只有真是绝对量（加起来不是 100）才写"总量"。
   */
  const sumIsShares = Math.abs(sum - 100) < 0.5;
  const topSlice = slices.reduce((best, s) => (s.pct > best.pct ? s : best), slices[0] ?? { pct: 0, label: "" });
  const centerMain = total !== undefined ? String(total) : sumIsShares ? `${topSlice.pct}%` : String(sum);
  const centerSub = total !== undefined || !sumIsShares ? "总量" : fitLabel(topSlice.label ?? "");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <ChartHeading page={page} chartTitle={title} />
      <svg width={isPortrait ? contentWidth : 1150} height={isPortrait ? 760 : 560}>
        {slices.map((s, i) =>
          s.pct > 0 ? <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={4} opacity={0.95} /> : null,
        )}
        <circle cx={cx} cy={cy} r={r * hole} fill="#fff" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={isPortrait ? fs(44) : 44}
          fontWeight={FW.heavy}
          fill={C.ink}
          fontFamily={FONT}
        >
          {centerMain}
        </text>
        <text
          x={cx}
          y={cy + (isPortrait ? sp(34) : 34)}
          textAnchor="middle"
          fontSize={isPortrait ? PORTRAIT_LEGEND_FS : 26}
          fill={C.sub}
          fontFamily={FONT}
        >
          {centerSub}
        </text>
        {!isPortrait &&
          slices.map((s, i) => {
            const legendTop = Math.max(8, 280 - (values.length * 84) / 2);
            return (
              <g key={`l${i}`}>
                <rect x={740} y={legendTop + i * 84} width={26} height={26} rx={6} fill={s.color} />
                <text
                  x={778}
                  y={legendTop + 20 + i * 84}
                  fontSize={32}
                  fontWeight={FW.bold}
                  fill={C.ink}
                  fontFamily={FONT}
                >
                  {fitLabel(s.label)}
                </text>
                <text x={778} y={legendTop + 52 + i * 84} fontSize={30} fill={C.sub} fontFamily={FONT}>
                  {s.pct}%
                </text>
              </g>
            );
          })}
      </svg>
      {isPortrait && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: sp(16),
            rowGap: sp(10),
            marginTop: sp(16),
            maxWidth: contentWidth,
          }}
        >
          {slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: sp(8) }}>
              <div style={{ width: sp(18), height: sp(18), borderRadius: 4, background: s.color }} />
              <span style={{ fontSize: fs(FS.body), fontWeight: FW.regular, color: C.ink }}>{fitLabel(s.label)}</span>
              <span style={{ fontSize: fs(FS.body), fontWeight: 700, color: C.sub }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const StackedBarScene: React.FC<SceneProps> = ({ page }) => {
  const chart = page.chart!;
  const { title, labels, series } = chart as Extract<
    ChartSpec,
    { labels: string[]; series: { name: string; values: number[] }[] }
  >;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const pal = SERIES;
  const maxTotal = Math.max(...labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0))) || 1;
  const n = labels.length;
  const availW = isPortrait ? contentWidth : 1920 - 160;
  const barGap = Math.max(
    isPortrait ? sp(24) : 24,
    Math.min(isPortrait ? sp(90) : 90, (availW - n * (isPortrait ? sp(60) : 60)) / Math.max(1, n - 1)),
  );
  const barW = Math.min(isPortrait ? 210 : 260, (availW - (n - 1) * barGap) / n);
  const labelFs = Math.min(isPortrait ? fs(FS.body) : FS.body, Math.max(16, barW));
  const chartH = isPortrait ? 840 : 440;
  const barMaxH = isPortrait ? 660 : 360;
  // 柱区底边：让出标签那一行，刻度才能与柱高对齐（此前标签在柱底下撑开，柱底位置不定）
  const barBottom = Math.round(labelFs * 1.2) + (isPortrait ? sp(18) : 18);
  const { top: stackTop, ticks: axisTicks } = axisScale(maxTotal);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <ChartHeading page={page} chartTitle={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: barGap,
          height: chartH,
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: isPortrait ? sp(barBottom) : barBottom,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${alpha(C.ink, 10)}, ${alpha(C.ink, 4)})`,
          }}
        />
        {/* Y 轴刻度：堆叠图此前连网格线都没有，柱高完全读不出来。
            柱区底边定在 barBottom（= 标签行高 + 间距），刻度与柱高共用 maxTotal 同一套比例 */}
        {axisTicks.map((t) => (
          <div
            key={`t${t.value}`}
            style={{ position: "absolute", left: 0, right: 0, bottom: barBottom + t.ratio * barMaxH - 1 }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background: alpha(C.ink, t.ratio === 0 ? 14 : 7),
              }}
            />
            <div
              style={{
                position: "absolute",
                right: "100%",
                marginRight: isPortrait ? sp(12) : 12,
                transform: "translateY(-50%)",
                // 横屏原来是 FS.small=20（画布宽 1%），同图分类标签却 36px，差 2.3 倍
                fontSize: isPortrait ? PORTRAIT_TICK_FS : 26,
                color: C.sub,
                fontFamily: FONT,
                fontWeight: FW.regular,
                whiteSpace: "nowrap",
              }}
            >
              {fmtTick(t.value)}
            </div>
          </div>
        ))}
        {labels.map((label, i) => {
          // 同 BarChart：堆叠柱的每一列也是同一个数据单元，不能拆到各句字幕上
          const grow = springIn(f, fps, 4 + i * 7, page.motion);
          const totalH = (series.reduce((a, s) => a + (s.values[i] || 0), 0) / stackTop) * barMaxH;
          return (
            <div key={i} style={{ position: "relative", width: barW, height: chartH }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: barBottom,
                  display: "flex",
                  flexDirection: "column-reverse",
                  height: `${totalH * grow}px`,
                  borderRadius: "14px 14px 0 0",
                  overflow: "hidden",
                }}
              >
                {series.map((s, si) => {
                  const segH = ((s.values[i] || 0) / stackTop) * barMaxH;
                  const segV = s.values[i] || 0;
                  return (
                    <div
                      key={si}
                      style={{
                        width: "100%",
                        height: `${segH}px`,
                        background: pal[si % pal.length],
                        // 段与段之间加一道浅色分隔线：调色板旋转后相邻两段可能是同一色相，
                        // 光靠 6px 色差根本分不出边界
                        borderTop: si === 0 ? "none" : "3px solid rgba(255,255,255,0.85)",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontFamily: FONT,
                        fontWeight: FW.heavy,
                        fontSize: isPortrait ? sp(26) : 24,
                        boxShadow: si === series.length - 1 ? tileShadow(pal[si % pal.length]) : "none",
                      }}
                    >
                      {/* 只有段够高才标数字，否则会溢出到相邻段 */}
                      {segH * grow > 42 ? fmtTick(segV) : ""}
                    </div>
                  );
                })}
              </div>
              {/* 柱顶合计：标题写着"成本结构（万元）"，不标合计观众读不出一年花了多少 */}
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  right: -8,
                  bottom: barBottom + totalH * grow + 10,
                  textAlign: "center",
                  fontSize: isPortrait ? PORTRAIT_VALUE_FS : FS.caption,
                  fontWeight: FW.heavy,
                  color: C.ink,
                  fontFamily: FONT,
                  whiteSpace: "nowrap",
                }}
              >
                {fmtTick(series.reduce((a, s) => a + (s.values[i] || 0), 0))}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  right: -8,
                  bottom: 0,
                  fontSize: labelFs,
                  fontWeight: 700,
                  color: C.ink,
                  fontFamily: FONT,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isPortrait ? sp(24) : 24,
          marginTop: isPortrait ? sp(20) : 20,
        }}
      >
        {series.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: isPortrait ? sp(8) : 8 }}>
            <div
              style={{
                width: isPortrait ? sp(18) : 18,
                height: isPortrait ? sp(18) : 18,
                borderRadius: 4,
                background: pal[i % pal.length],
              }}
            />
            <span style={{ fontSize: isPortrait ? fs(FS.body) : FS.body, fontWeight: FW.regular, color: C.ink }}>
              {s.name}
            </span>
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
  const { isPortrait, sp, contentWidth } = useResponsive();
  const W = isPortrait ? contentWidth : 1500,
    // 560 会让 x 轴标签贴到字幕条（实测只剩 11px），520 配 PAD_T 仍然把绘图区从 325 抬到 410
    H = isPortrait ? 900 : 520,
    PAD = isPortrait ? sp(110) : 110,
    BOTTOM = isPortrait ? sp(70) : 70;
  /*
   * PAD 原来同时当左右内边距和**顶部内边距**用（ys 里写的是 H-PAD-BOTTOM），
   * 于是 SVG 顶部那 110px 永远是空的：绘图区只占画布 30%，
   * 标题下沿到最高网格线之间空出 200px 纯白。顶部内边距单独给一个小值。
   */
  const PAD_T = isPortrait ? sp(60) : 40;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs);
  const yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1,
    yRange = yMax - yMin || 1;
  // 横向内缩 6%：xMin 正好落在竖轴上时，最左边的点会被轴线劈成两半
  const px = (x: number) => PAD + 0.06 * (W - PAD * 2) + ((x - xMin) / xRange) * 0.88 * (W - PAD * 2);
  const py = (y: number) => H - BOTTOM - ((y - yMin) / yRange) * (H - PAD_T - BOTTOM);
  // 散点是「区间映射」（min~max 铺满绘图区），所以刻度要从区间里取整数步长，
  // 不能套用柱状图那种从 0 起的 axisScale
  const scatterStep = niceStep(yRange / 4);
  const yTicks = Array.from({ length: 8 }, (_, i) => yMin + i * scatterStep)
    .filter((v) => v <= yMax + scatterStep * 0.001 && v >= yMin - scatterStep * 0.001)
    .map((v) => ({ value: Math.round(v * 100) / 100, y: py(v) }));
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        // 整组上移：居中的画布里 x 轴标签离字幕条只剩 17px（H=520 时实测）
        paddingBottom: isPortrait ? 0 : 88,
      }}
    >
      <ChartHeading page={page} chartTitle={title} />
      <svg width={W} height={H + (isPortrait ? sp(44) : 44)}>
        {yTicks.map((t) => (
          <g key={`g${t.value}`}>
            <line
              x1={PAD}
              y1={t.y}
              x2={W - PAD}
              y2={t.y}
              stroke={C.ink}
              strokeOpacity={t.value === 0 ? 0.16 : 0.08}
              strokeWidth={t.value === 0 ? 3 : 2}
              strokeDasharray={t.value === 0 ? undefined : "6 8"}
            />
            <text
              x={PAD - (isPortrait ? sp(16) : 16)}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={isPortrait ? PORTRAIT_TICK_FS : LAND_TICK_FS}
              fill={C.sub}
              fontFamily={FONT}
            >
              {fmtTick(t.value)}
            </text>
          </g>
        ))}
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - BOTTOM} stroke={C.ink} strokeOpacity={0.16} strokeWidth={3} />
        {points.map((p, i) => {
          // 散点同理：按字幕分批会让图在前半段看起来只有一半数据
          const o = springIn(f, fps, 12 + i * 4, page.motion);
          return (
            <g key={i} opacity={o}>
              <circle
                cx={px(p.x)}
                cy={py(p.y)}
                r={isPortrait ? sp(16) : 16}
                fill={C.accent}
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={isPortrait ? sp(4) : 4}
              />
              {p.label && (
                <text
                  x={px(p.x)}
                  y={py(p.y) - (isPortrait ? sp(24) : 24)}
                  textAnchor="middle"
                  fontSize={isPortrait ? PORTRAIT_LEGEND_FS : 26}
                  fontWeight={FW.bold}
                  fill={C.ink}
                  fontFamily={FONT}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
