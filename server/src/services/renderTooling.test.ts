import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 渲染工具链守卫。
 *
 * 这一轮为了查"改了样式却没生效"建了 DOM 探针，顺手踩出两个**静默出错**的坑，
 * 两个都不会报错、只会让调试结果指错方向，所以用源码级守卫钉住：
 *
 *   1. 局部渲染（GALLERY_ONLY / probe）若只把过滤后的页面传给 composition，
 *      目标页会变成"第一页"，而 sceneRegistry 第一条是 `isFirst → TitleScene`，
 *      拿到的根本是别的版式。必须始终传完整列表，只过滤"渲哪几张"。
 *   2. `Card` 外层只写 `display: flex` 不写方向时默认是 row，内部玻璃底变成
 *      按内容收缩的 flex item，外面给多宽都传导不下去——这正是"宽度设了不生效"的根因。
 */

// 相对测试文件定位仓库根：套件里 cwd 是 server/（其他守卫测试也按这个假设写的），
// 用 cwd 拼路径在这里会静默指到 server/server/scripts
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const readScript = (rel: string) => fs.readFileSync(path.join(repoRoot, "server", "scripts", rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

test("gallery / probe 都按完整页面列表渲染，避免目标页被 TitleScene 接管", () => {
  for (const file of ["gallery.mjs", "probe.mjs"]) {
    const src = stripComments(readScript(file));
    assert.match(src, /pages: PAGES\b/, `${file} 必须把完整 PAGES 传给 composition（pages: PAGES）`);
    assert.doesNotMatch(src, /pages: targets\b/, `${file} 不能把过滤后的 targets 当时间轴传给 composition`);
  }
});

test("gallery / probe 的起始帧按完整时间轴计算", () => {
  const gallery = stripComments(readScript("gallery.mjs"));
  // 起始帧循环必须遍历 PAGES；遍历 targets 会让过滤后的第一页 offset 为 0
  assert.match(gallery, /PAGES\.forEach\(/, "gallery.mjs 的起始帧必须按 PAGES 累计");
  const probe = stripComments(readScript("probe.mjs"));
  assert.match(probe, /PAGES\.forEach\(/, "probe.mjs 的起始帧必须按 PAGES 累计");
});

test("run-render 支持把页面 console 落盘，供 DOM 探针读取", () => {
  const src = stripComments(fs.readFileSync(path.join(repoRoot, "server", "render", "run-render.mjs"), "utf8"));
  assert.match(src, /browserLogPath/, "run-render.mjs 必须支持 options.browserLogPath");
  assert.match(src, /onBrowserLog/, "run-render.mjs 必须把 onBrowserLog 传给 renderStill");
});

test("要点卡的 Card 外层必须写明 flex 方向（否则内部玻璃底按内容收缩）", () => {
  const src = stripComments(
    fs.readFileSync(
      path.join(repoRoot, "server", "render", "src", "shared", "render", "scenes", "PointsScene.tsx"),
      "utf8",
    ),
  );
  const cardBlocks = src.match(/<Card\b[\s\S]{0,600}?>/g) ?? [];
  assert.ok(cardBlocks.length > 0, "没能定位到 PointsScene 里的 <Card>");
  for (const block of cardBlocks) {
    if (!/display:\s*"flex"/.test(block)) continue;
    assert.match(
      block,
      /flexDirection:\s*"column"/,
      `<Card> 外层写了 display: "flex" 就必须写 flexDirection，否则内部玻璃底会按内容宽度收缩：\n${block.slice(0, 200)}`,
    );
  }
});
