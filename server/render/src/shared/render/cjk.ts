/**
 * 中文折行：优先断在标点处。
 *
 * 浏览器的 `text-wrap: balance` 只按宽度均分两行，不看标点——
 * 「审批链过长，决策被反复上推」会被断成「审批链过长，决 / 策被反复上推」，
 * 把"决策"劈成两半。中文排版的习惯是断在逗号、顿号这类停顿处，
 * 所以这里先按标点找断点，找不到合适的标点才交回浏览器自然折行。
 *
 * 纯函数、无依赖，方便单测（分行的边界条件最容易写错，且错了不会报错，只会难看）。
 */

/** 允许断行的标点：逗号、顿号、分号、冒号（中英文都认） */
const BREAK_PUNCT = /[，、；：,;:]/;

/**
 * 把一段文字按"每行最多 perLine 个字"重新分行，尽量断在标点后。
 *
 * 返回 null 表示"没有合适的标点断点，交给浏览器自然折行"。
 *
 * 采用条件（缺一不可）：
 *   - 断点在标点之后；
 *   - 断完正好两行，且**每行都不超过 perLine**（否则等于把溢出留给浏览器，白断一次）；
 *   - 首行不少于三成五的宽度（否则会出现「一二，/ 长长长长长长长」这种头重脚轻）。
 * 不满足就返回 null——宁可交给浏览器，也不要为排版把话断得七零八落或溢出。
 */
export const linesByPunct = (text: string, perLine: number, maxLines = 2): string[] | null => {
  const chars = Array.from(text);
  const limit = Math.max(1, Math.floor(perLine));
  if (chars.length <= limit) return null;

  // 所有标点后的位置（即"可以在此处换行"的下标）
  const cuts: number[] = [];
  chars.forEach((ch, i) => {
    if (BREAK_PUNCT.test(ch) && i + 1 < chars.length) cuts.push(i + 1);
  });
  if (!cuts.length) return null;

  const minFirst = Math.max(2, Math.ceil(limit * 0.35));
  const usable = cuts.filter((c) => {
    const rest = chars.length - c;
    return c >= minFirst && c <= limit && rest >= 1 && rest <= limit * (maxLines - 1);
  });
  if (!usable.length) return null;

  // 目标断点：让第一行尽量接近但不超过一行宽度
  const target = limit;
  const cut = usable.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), usable[0]);

  const lines = [chars.slice(0, cut).join(""), chars.slice(cut).join("")].filter((s) => s.length > 0);
  return lines.length > maxLines ? null : lines;
};
