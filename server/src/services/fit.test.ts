import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type * as FitTypes from "../../render/src/shared/render/fit";

/*
 * 为什么不直接 `import { portraitFill } from ...`：
 *
 * 渲染子包 `server/render` 的 package.json 没有 `"type": "module"（默认 CJS），
 * 而服务端是 ESM。ESM 引入 CJS 时只能拿到 default、拿不到具名导出
 * （报 `does not provide an export named 'portraitFill'`）。这里用 require + 类型断言，
 * 既能跑起来又不丢类型。
 */
const requireFit = createRequire(import.meta.url);
const { portraitFill, surplusGap } = requireFit("../../render/src/shared/render/fit.ts") as typeof FitTypes;

/**
 * 竖屏稀疏页的两个纯函数。
 *
 * 这两个函数决定整页的字号和间距，一直没单测——出问题时只能靠"看着空"发现。
 * 都是纯数学，直接钉边界值。
 */
test("surplusGap：元素少于 2 个没有“档”可摊，返回 0", () => {
  assert.equal(surplusGap(300, 1400, 0), 0);
  assert.equal(surplusGap(300, 1400, 1), 0);
});

test("surplusGap：内容已经到目标填充率时不硬撑", () => {
  // 1400 * 0.78 = 1092
  assert.equal(surplusGap(1092, 1400, 3), 0);
  assert.equal(surplusGap(1200, 1400, 3), 0);
});

test("surplusGap：富余高度按档数摊开", () => {
  // 剩余 420，2 个间距 -> 210，但封顶 150
  assert.equal(surplusGap(672, 1400, 3, { target: 0.78, maxGap: 150 }), 150);
  // 剩余 240，3 个间距 -> 80
  assert.equal(surplusGap(852, 1400, 4, { target: 0.78, maxGap: 150 }), 80);
});

test("surplusGap：异常输入不会给出 NaN 或负数", () => {
  assert.equal(surplusGap(0, 1400, 3), 0);
  assert.equal(surplusGap(300, 0, 3), 0);
  assert.equal(surplusGap(Number.NaN, 1400, 3), 0);
  assert.equal(surplusGap(100, 1400, 3, { maxGap: 0 }), 0);
});

test("portraitFill：三条短要点要能放到上限，而不是被估算压成 1", () => {
  const band = 1330;
  const z = portraitFill(342, band, { max: 1.6, target: 0.86 });
  assert.equal(z, 1.6, "空页必须能放到上限，否则就是之前的 38%");
  assert.equal(portraitFill(band, band), 1, "已经满的页不该被放大（也不该被缩小）");
});
