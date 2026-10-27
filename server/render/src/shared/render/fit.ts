/**
 * 版面适配的两个纯函数。
 *
 * 单独放一个模块是为了能单测：`responsive.ts` 依赖 remotion / React context，
 * 在 `node:test` 里 import 不动（同一坑在 chartScale.ts 上踩过）。
 * 这里不 import 任何东西，测起来零依赖。
 */

/** 量一段文字宽度：生产环境用真实的字体度量，测试与兜底用字符宽度模型 */
export type Measurer = (text: string, fontSize: number, fontWeight: number | string) => number;

/**
 * 字符宽度模型的兜底实现（拿不到真实字体度量时用）。
 *
 * 中日韩字符按 1 个字号宽、拉丁字母与数字按 0.56、空格按 0.3 —— 粗的依据是
 * 这套版面里正文几乎全是中文，宁可估宽一点（估窄会溢出，估宽只是多留白）。
 */
export const modelMeasure: Measurer = (text, fontSize) => {
  let units = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) units += 0.3;
    else if (/[\u3000-\u9fff\uff00-\uffef]/.test(ch)) units += 1;
    else units += 0.56;
  }
  return units * fontSize;
};

/** 估算一段文字在给定宽度下会折成几行（最少 1 行） */
export const estLinesWith =
  (measure: Measurer = modelMeasure) =>
  (text: string, fontSize: number, maxW: number, fontWeight: number | string = 600): number =>
    Math.max(1, Math.ceil(measure(text, fontSize, fontWeight) / Math.max(1, maxW)));

/**
 * 竖屏"稀疏页放大"系数。
 *
 * 竖屏画布 1080×1920，竖向空间是横屏两倍，但字号是按"每行放多少字"定的，
 * 于是内容量少的页只占中间一小块：实测 `qa` 内容高 285px / 可用带约 1440px（20%），
 * `points`（3 条）37%，`two_column` 35%——上下各一大片空白，像没做完。
 *
 * 按"内容估算高度"反推放大量，让内容占到目标填充率；封顶避免字大到折行折出孤字。
 */
export const portraitFill = (
  contentH: number,
  bandH: number,
  opts: { max?: number; target?: number; min?: number } = {},
): number => {
  const { max = 1.5, target = 0.62, min = 1 } = opts;
  if (!(contentH > 0) || !(bandH > 0)) return min;
  const raw = (bandH * target) / contentH;
  return Math.min(max, Math.max(min, Number(raw.toFixed(3))));
};
