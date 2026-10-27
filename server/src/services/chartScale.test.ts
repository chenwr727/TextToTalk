import { test } from "node:test";
import assert from "node:assert/strict";
// 这个模块被 tsx 以 CJS 形式加载（render 目录的 module 设置与 server 不同），
// 命名导入拿不到具名导出，这里同时兼容「命名空间」与「default 挂在命名空间上」两种形态
import * as chartScaleNs from "../../render/src/shared/render/chartScale";
type ChartScaleModule = typeof import("../../render/src/shared/render/chartScale");
const scale = ((chartScaleNs as unknown as { default?: ChartScaleModule }).default ?? chartScaleNs) as ChartScaleModule;
const { axisScale, fmtTick, niceStep, unitOf, yAxisOf } = scale;

/**
 * 图表刻度与数值格式化的单测。
 *
 * 这块逻辑此前埋在 Charts.tsx（900 行、import 了 remotion）里，只能靠看静帧判断对错。
 * 拆成纯函数后，这几条踩过的坑都能锁死。
 */

test("步长取整：1/1.5/2/2.5/3/4/5 阶梯，结果总是 10 的幂乘以阶梯值", () => {
  assert.equal(niceStep(10.25), 15, "41/4 应该取 15，而不是 20（否则顶值被抬到 80）");
  assert.equal(niceStep(9.5), 10);
  assert.equal(niceStep(11.5), 15);
  assert.equal(niceStep(0), 1, "非法输入兜底为 1，避免除零");
  assert.equal(niceStep(Number.NaN), 1);
  for (const raw of [0.3, 3, 37, 250, 1234]) {
    const step = niceStep(raw);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    assert.ok(step >= raw - 1e-9, `${raw} 的步长 ${step} 不应小于输入`);
    assert.ok(step / mag <= 10 + 1e-9, `${raw} 的步长 ${step} 不应超过一个数量级`);
  }
});

test("刻度不会溢出绘图区，且顶值能被步长整除", () => {
  for (const dataMax of [1, 7, 38, 41, 46, 99, 100, 333, 12000]) {
    const { top, ticks } = axisScale(dataMax);
    assert.ok(top >= dataMax, `${dataMax}: 顶值 ${top} 必须能容纳数据`);
    for (const t of ticks) {
      assert.ok(t.ratio >= -1e-9 && t.ratio <= 1 + 1e-9, `${dataMax}: 刻度 ${t.value} 的 ratio=${t.ratio} 溢出 0~1`);
    }
    assert.equal(ticks[0].value, 0, `${dataMax}: 刻度必须从 0 起`);
    assert.equal(ticks[ticks.length - 1].value, top, `${dataMax}: 最后一条刻度应正好落在顶值上`);
    const step = ticks[1].value - ticks[0].value;
    assert.ok(Math.abs(top / step - Math.round(top / step)) < 1e-9, `${dataMax}: 顶值 ${top} 应能被步长 ${step} 整除`);
  }
});

test("刻度数值用中文口径缩写", () => {
  assert.equal(fmtTick(0), "0");
  assert.equal(fmtTick(38), "38");
  assert.equal(fmtTick(1.25), "1.3");
  assert.equal(fmtTick(12000), "1.2万");
  assert.equal(fmtTick(200000000), "2亿");
});

test("单位识别：括号里的单位、标题尾部的单位；非单位说明不误判", () => {
  assert.equal(unitOf("成本结构（万元）"), "万元");
  assert.equal(unitOf("成本结构(万元)"), "万元");
  assert.equal(unitOf("平均滞留 天"), "天");
  assert.equal(unitOf("转化率 %"), "%");
  assert.equal(unitOf("2021-2023 年"), "年");
  // 这些括号里是说明而不是单位，不能标成单位
  assert.equal(unitOf("规模趋势（2021-2023）"), null);
  assert.equal(unitOf("试点结果（第一阶段）"), null);
  assert.equal(unitOf("落地周期"), null);
  assert.equal(unitOf(""), null);
  assert.equal(unitOf(undefined), null);
});

test("折线类 Y 轴留出顶部余量：最高点不贴上边框", () => {
  const plotH = 300;
  const baselineY = 400;
  const { max, ticks } = yAxisOf(41, plotH, baselineY);
  assert.ok(max > 45, `顶值 ${max} 应高于刻度顶值，给最高点留余量`);
  assert.equal(ticks[ticks.length - 1].y < baselineY, true, "刻度自下而上递减 y 坐标");
  assert.equal(ticks[0].y, baselineY, "0 刻度落在基线上");
});
