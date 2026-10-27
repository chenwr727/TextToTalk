import { test } from "node:test";
import assert from "node:assert/strict";
import * as cjkNs from "../../render/src/shared/render/cjk";

/**
 * 中文按标点折行的单测。
 *
 * 这条规则决定"卡片里两行字断在哪"：断错了不会报错，只会把「决策」劈成
 * 「决 / 策被反复上推」这种难看的样子。边界条件（没有标点、标点太靠前、
 * 一行放得下）都得钉住，否则改宽度参数时会静默变回自然折行。
 */
type CjkModule = { linesByPunct: (text: string, perLine: number, maxLines?: number) => string[] | null };

const cjk = ((cjkNs as unknown as { default?: CjkModule }).default ?? cjkNs) as unknown as CjkModule;

test("linesByPunct：断在逗号后，不劈词", () => {
  const lines = cjk.linesByPunct("审批链过长，决策被反复上推", 11);
  assert.deepEqual(lines, ["审批链过长，", "决策被反复上推"]);
});

test("linesByPunct：一行放得下就不动它", () => {
  assert.equal(cjk.linesByPunct("审批链过长", 11), null);
  // 刚好等于上限也交给浏览器（不做无意义的单行拆分）
  assert.equal(cjk.linesByPunct("一二三四五六七八九十一", 11), null);
});

test("linesByPunct：没有标点则返回 null，交回浏览器自然折行", () => {
  assert.equal(cjk.linesByPunct("一段没有任何停顿的长句子测试用例", 5), null);
});

test("linesByPunct：断完仍有一行超长时不采用（等于白断一次）", () => {
  // 每行最多 5 字，逗号后断开会得到「一二，/ 三三四四五五六六七七」（9 字，仍溢出）
  assert.equal(cjk.linesByPunct("一二，三三四四五五六六七七", 5), null);
});

test("linesByPunct：多标点时选让两行都放得下的那个", () => {
  // 18 个字、每行最多 12 字：只有断在第一个逗号后（7 + 11）两行才都放得下
  const lines = cjk.linesByPunct("责任边界模糊，没人愿意拍板，最后拖", 12);
  assert.ok(lines, "应当能断成两行");
  assert.equal(lines!.length, 2);
  assert.ok(lines![0].endsWith("，"), `第一行应以标点结尾，实际：${lines![0]}`);
  for (const l of lines!) assert.ok(Array.from(l).length <= 12, `每行不得超过 12 字：${l}`);
});

test("linesByPunct：标点太靠前（首行不足三成五宽）时不采用", () => {
  // 每行最多 20 字，逗号在第 3 个字：断开会得到极短首行，交回浏览器
  assert.equal(cjk.linesByPunct("一二三，四五六七八九十一二三四五六七八九十一二三", 20), null);
});
