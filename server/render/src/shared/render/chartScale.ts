/**
 * 图表刻度与数值格式化的纯函数。
 *
 * 这些逻辑原先埋在 Charts.tsx（900+ 行、还 import 了 remotion）里，既测不了也难复用。
 * 拆出来后可以直接单测：步长选择、顶值回推、刻度是否溢出绘图区、单位识别。
 */

/**
 * 取「好看的」步长：1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 × 10^n。
 *
 * 只用 1/2/2.5/5 时，数据 41 会被一路排到顶值 80（折线压在下面半屏）；
 * 带上 1.5/3/4 后同样的数据排到 45，曲线才占满绘图区。
 */
export const niceStep = (raw: number): number => {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const set = [1, 1.5, 2, 2.5, 3, 4, 5, 10];
  const step = set.find((s) => norm <= s + 1e-9) ?? 10;
  return step * mag;
};

export interface AxisTick {
  value: number;
  /** 相对顶值的比例，0~1；用于换算成像素位置 */
  ratio: number;
}

export interface AxisScale {
  /** 顶值（一定能被步长整除） */
  top: number;
  ticks: AxisTick[];
}

/**
 * 把数据最大值换算成「从 0 起算、等距、能被步长整除」的刻度。
 *
 * 两条硬性约束（都踩过坑）：
 * 1) 刻度必须停在 top 上。曾按 count+1 生成，top=60 时还会多出 80 这条线，ratio>1 溢出绘图区；
 * 2) 顶值要能被步长整除，否则柱高与刻度线对不上（38 的柱子顶在 40 的格线上）。
 */
export const axisScale = (dataMax: number, count = 4): AxisScale => {
  const step = niceStep((dataMax || 1) / count);
  const top = Math.max(step, Math.ceil((dataMax || 1) / step - 1e-9) * step);
  const n = Math.max(1, Math.round(top / step));
  const ticks = Array.from({ length: n + 1 }, (_, i) => ({
    value: Math.round(i * step * 1000) / 1000,
    ratio: (i * step) / top,
  }));
  return { top, ticks };
};

/** 刻度数值：中文内容里 12000 写成 1.2 万比 12k 自然 */
export const fmtTick = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 100000000) return `${Math.round((v / 100000000) * 10) / 10}亿`;
  if (a >= 10000) return `${Math.round((v / 10000) * 10) / 10}万`;
  return `${Math.round(v * 10) / 10}`;
};

/**
 * 从图表标题里识别单位。
 *
 * 规格里没有独立的 unit 字段，AI 常把单位写在 chart.title 里（「成本结构（万元）」）。
 * 认出来才能标在坐标轴/副标题上；认不出（括号里是「2021-2023」「试点阶段」这类说明）返回 null。
 */
const UNIT =
  /^(?:万元|亿元|百万|万|亿|千|元|[%‰]|百分点|个百分点|天|日|周|月|年|季度|小时|分钟|秒|人|次|个|件|单|分|倍)$/;

export const unitOf = (text: string | undefined): string | null => {
  const s = String(text ?? "").trim();
  if (!s) return null;
  const paren = s.match(/[（(]\s*([^）)]{1,6})\s*[）)]/);
  if (paren && UNIT.test(paren[1].trim())) return paren[1].trim();
  const tail = s.match(/(万元|亿元|百分点|个百分点|分钟|小时|季度|万|亿|元|天|日|周|月|年|人|次|个|件|单|倍|[%‰])$/);
  return tail ? tail[1] : null;
};

/**
 * 折线 / 面积 / 散点图共用的 Y 轴：返回统一比例下的顶值，以及每条刻度线的像素 y。
 *
 * 与柱状图不同的是这里留 15% 顶部余量：折线的最高点贴着上边框会很难看。
 */
export const yAxisOf = (
  dataMax: number,
  plotH: number,
  baselineY: number,
  count = 4,
): { max: number; ticks: { value: number; y: number }[] } => {
  const { top, ticks } = axisScale(dataMax, count);
  const max = top * 1.15;
  return {
    max,
    ticks: ticks.map((t) => ({ value: t.value, y: baselineY - (t.value / max) * plotH })),
  };
};
