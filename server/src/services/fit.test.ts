import { test } from "node:test";
import assert from "node:assert/strict";
import * as fitNs from "../../render/src/shared/render/fit";

/**
 * 竖屏稀疏页放大（portraitFill）、折行估算（estLines）与间距摊派（surplusGap）的单测。
 *
 * 这几个函数决定"竖屏内容占画布多少"，估错了不会报错，只会让整页内容要么缩成
 * 一小块、要么折出孤字或溢出。用测试把边界钉住，避免下次调参把哪一头碰坏。
 */
type FitModule = {
  portraitFill: (h: number, band: number, opts?: { max?: number; target?: number; min?: number }) => number;
  surplusGap: (contentH: number, bandH: number, count: number, opts?: { target?: number; maxGap?: number }) => number;
  modelMeasure: (text: string, fontSize: number, weight?: number | string) => number;
  estLinesWith: (
    measure?: (t: string, fs: number, w: number | string) => number,
  ) => (text: string, fontSize: number, maxW: number, weight?: number | string) => number;
};

// tsx 的 CJS 互操作：具名导出有时挂在 default 上（chartScale.test.ts 同样处理）
const fit = ((fitNs as unknown as { default?: FitModule }).default ?? fitNs) as unknown as FitModule;

test("portraitFill：内容越空放得越大，但不超过封顶", () => {
  // 内容 285、可用带 1440、目标 58%：需要放 2.9 倍，封顶 1.5
  assert.equal(fit.portraitFill(285, 1440, { max: 1.5, target: 0.58 }), 1.5);
  // 内容已经接近目标填充率时不放大
  assert.equal(fit.portraitFill(800, 1440, { max: 1.5, target: 0.58 }), 1.044);
  // 内容超额时不得缩小（缩小交给各场景自己的适配逻辑）
  assert.equal(fit.portraitFill(2000, 1440, { target: 0.58 }), 1);
});

test("portraitFill：异常输入退回 1，不会把版面放大成 NaN 宽度", () => {
  assert.equal(fit.portraitFill(0, 1440), 1);
  assert.equal(fit.portraitFill(285, 0), 1);
  assert.equal(fit.portraitFill(Number.NaN, 1440), 1);
  assert.equal(fit.portraitFill(-5, -5), 1);
});

test("portraitFill：三条短要点必须能放到上限，而不是被估算压成 1", () => {
  // points 的实测值：三条短句估 342px，可用带 1330px
  assert.equal(
    fit.portraitFill(342, 1330, { max: 1.6, target: 0.86 }),
    1.6,
    "空页放不到上限，就是竖屏 content 只占 38% 的那条老路",
  );
});

test("surplusGap：元素少于 2 个没有“档”可摊，返回 0", () => {
  assert.equal(fit.surplusGap(300, 1400, 0), 0);
  assert.equal(fit.surplusGap(300, 1400, 1), 0);
});

test("surplusGap：内容已经到目标填充率时不再硬撑", () => {
  // 1400 * 0.78 = 1092
  assert.equal(fit.surplusGap(1092, 1400, 3), 0);
  assert.equal(fit.surplusGap(1200, 1400, 3), 0);
});

test("surplusGap：富余高度按档数摊开，并受 maxGap 封顶", () => {
  // 剩余 420、2 个间距 → 210，封顶 150
  assert.equal(fit.surplusGap(672, 1400, 3, { target: 0.78, maxGap: 150 }), 150);
  // 剩余 240、3 个间距 → 80，没到封顶
  assert.equal(fit.surplusGap(852, 1400, 4, { target: 0.78, maxGap: 150 }), 80);
});

test("surplusGap：异常输入不会给出 NaN 或负数", () => {
  assert.equal(fit.surplusGap(0, 1400, 3), 0);
  assert.equal(fit.surplusGap(300, 0, 3), 0);
  assert.equal(fit.surplusGap(Number.NaN, 1400, 3), 0);
  assert.equal(fit.surplusGap(100, 1400, 3, { maxGap: 0 }), 0);
});

test("modelMeasure：中文字宽约等于字号，拉丁字母明显更窄", () => {
  const fsPx = 40;
  assert.equal(fit.modelMeasure("四个字符", fsPx), fsPx * 4);
  // 6 个拉丁字母（6×0.56=3.36 字宽）应比 4 个汉字窄
  assert.ok(fit.modelMeasure("abcdef", fsPx) < fit.modelMeasure("四个字符", fsPx));
  assert.ok(fit.modelMeasure("a b", fsPx) < fit.modelMeasure("abc", fsPx));
});

test("estLinesWith：至少一行，并按宽度递增折行", () => {
  const estLines = fit.estLinesWith(fit.modelMeasure);
  assert.equal(estLines("短句", 40, 900), 1);
  // 20 个汉字 × 40px = 800px；可用宽 400px → 2 行
  assert.equal(estLines("一二三四五六七八九十一二三四五六七八九十", 40, 400), 2);
  // 同样的字、更窄的容器 → 行数更多
  assert.ok(estLines("一二三四五六七八九十一二三四五六七八九十", 40, 200) > 2);
  // 宽高为 0 时不抛异常，退化成 1 行之后再被 ceil 放大，但不会得到 0 行
  assert.ok(estLines("字", 40, 0) >= 1);
});

test("estLinesWith：可注入度量，方便换成真实字体度量", () => {
  const alwaysWide = fit.estLinesWith(() => 10_000);
  assert.ok(alwaysWide("任意文字", 40, 500) > 1);
  const alwaysNarrow = fit.estLinesWith(() => 1);
  assert.equal(alwaysNarrow("任意文字", 40, 500), 1);
});
