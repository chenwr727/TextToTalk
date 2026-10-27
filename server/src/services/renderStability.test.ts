import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 画面稳定性守卫。
 *
 * 起因：成片里"文字轻微晃动"，抽帧做像素差分定位到两个根因——
 * 1. rhythm="anchor"（默认节奏）给整页加了 1 → 1.03 的连续缩放，
 *    每帧只挪 0.1px：看着不像运动，只像文字在抖；
 * 2. 字幕里数字高亮时切 font-weight，粗体改变字宽，高亮扫过时整句左右跳一下。
 *
 * 单测没法比对像素，但可以守住"不要再把整页文字放进逐帧变化的变换里"这条不变量。
 * 这几条断言对应的都是"看着像 bug、实则是设计"的东西，所以必须在代码层面挡回来。
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const renderSrc = path.join(here, "..", "..", "render", "src");
const read = (rel: string) => readFileSync(path.join(renderSrc, rel), "utf-8");

describe("画面稳定性：文字不得逐帧重新光栅化", () => {
  test("PageBody 不再用整页时长驱动 scale（会变成逐帧亚像素缩放）", () => {
    const src = read(path.join("scenes", "PageBody.tsx"));
    const pageLongScale = /interpolate\([^)]*pageFrames[^)]*\)[^;]*[\s\S]{0,120}scale\(/i.test(src);
    assert.equal(pageLongScale, false, "整页 pageFrames 驱动的 scale 会让全部文字每帧重新抗锯齿，看起来像在抖");
  });

  test("springIn 到站后吸附成精确的 0/1（否则尾巴上 1e-4 的差值也会抖）", () => {
    const src = read(path.join("shared", "render", "theme.ts"));
    assert.match(src, /export const settle\s*=/, "缺少 settle 辅助函数");
    assert.match(
      src,
      /return settle\(spring\(/,
      "springIn 的返回值必须过 settle：弹簧是渐近收敛的，第 60 帧仍差 0.00015，换算成位移就是亚像素抖动",
    );
  });

  test("字幕卡拉 OK 不切 font-weight（粗体改变字宽会导致整行重排跳动）", () => {
    const src = read(path.join("components", "Caption.tsx"));
    const karaokeNum = /on\s*&&\s*tk\.num\s*\?[^,\n]*FW\./.test(src);
    assert.equal(karaokeNum, false, "数字高亮只能用颜色/发光，不能用字重：字重变化会改变字宽");
  });
});
