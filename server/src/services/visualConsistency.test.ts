import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 视觉一致性守卫。
 *
 * 这一轮"美化每个组件"修的多数是**静默失效**类问题：写死色导致的换主题不生效、
 * CSS 变量拼后缀导致的非法声明、SVG 属性里塞 color-mix 导致的整块元素不渲染。
 * 这类问题不会报错、不会让测试失败，只会让画面"看起来有点不对劲"，
 * 所以用源码级守卫固定住，避免下次改版又改回去。
 */

const RENDER_SRC = path.join(process.cwd(), "render", "src");
const readRaw = (rel: string) => fs.readFileSync(path.join(RENDER_SRC, rel), "utf8");
/** 去掉块注释/行注释：注释里出现的反例写法（比如"曾经写死过 #6d91ff"）不该触发守卫 */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string) => stripComments(readRaw(rel));

/** 递归收集渲染端所有 tsx/ts 源文件（相对 render/src 的路径） */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path.relative(RENDER_SRC, full).replace(/\\/g, "/"));
  }
  return out;
}

test("主题色不能被写死：图表/对比页/地图都走 accentOf 或 C.*", () => {
  const charts = read("shared/render/scenes/Charts.tsx");
  // 这四个十六进制是 tech 主题调色板的副本，写死会导致饼图/环图在其它主题下不跟随
  for (const hex of ["#6d91ff", "#34c79f", "#f2b03f", "#e868a4"]) {
    assert.ok(!charts.includes(hex), `Charts.tsx 不应再写死 ${hex}，应使用 accentOf(i)`);
  }
  assert.match(charts, /const SERIES = \[accentOf\(/, "图表多系列配色应来自 accentOf 序列");

  const comparison = read("shared/render/scenes/ComparisonScene.tsx");
  assert.ok(!comparison.includes("#2fc6a1"), "ComparisonScene 徽标色应使用 accentOf，不要写死 tech 调色板");
  assert.ok(!comparison.includes("#f2a93b"), "ComparisonScene 徽标色应使用 accentOf，不要写死 tech 调色板");
});

test("CSS 变量上不能拼十六进制后缀（var(--ttt-x)47 是非法值，整条声明会被丢弃）", () => {
  for (const file of walk(RENDER_SRC)) {
    const src = read(file);
    // 形如 `${pal[i]}47`、`${accent}cc`：紧跟在插值后的 2 位十六进制
    const bad = src.match(/\$\{[^}]*\}[0-9a-fA-F]{2}[`"']/g) ?? [];
    assert.deepEqual(bad, [], `${file} 里出现了给 CSS 变量拼十六进制后缀的写法：${bad.join(", ")}`);
  }
});

test("SVG 属性里不能用 color-mix()（浏览器按无效值丢弃，元素会整块消失）", () => {
  for (const file of walk(RENDER_SRC)) {
    const src = read(file);
    // alpha() 产出的是 color-mix(...)，只能用于 style，不能用于 stroke/fill/stopColor 等 SVG 属性
    const bad = src.match(/(stroke|fill|stopColor|floodColor)=\{alpha\(/g) ?? [];
    assert.deepEqual(bad, [], `${file} 在 SVG 属性里用了 alpha()，请改成「颜色 + 透明度」属性：${bad.join(", ")}`);
  }
});

test("卡片材质统一走 Card 组件：场景里不再手写玻璃底 + 圆角 + 卡片影", () => {
  const cardConsumers = [
    "shared/render/scenes/ThreeCardScene.tsx",
    "shared/render/scenes/StepsScene.tsx",
    "shared/render/scenes/StatsScene.tsx",
    "shared/render/scenes/QaScene.tsx",
    "shared/render/scenes/TwoColumnScene.tsx",
    "shared/render/scenes/ComparisonScene.tsx",
    "shared/render/scenes/PointsScene.tsx",
    "shared/render/scenes/TableScene.tsx",
  ];
  for (const file of cardConsumers) {
    assert.match(read(file), /<Card\b/, `${file} 应使用统一的 <Card>`);
  }
  // 图标方块同理：6 个场景曾经各写一套尺寸/圆角/阴影
  for (const file of ["shared/render/scenes/StepsScene.tsx", "shared/render/scenes/StatsScene.tsx"]) {
    assert.match(read(file), /<IconTile\b/, `${file} 的图标方块应使用 <IconTile>`);
  }
});

test("table 页标题走 PageHeading，不再自绘（否则换主题时整页标题语言会掉队）", () => {
  const table = read("shared/render/scenes/TableScene.tsx");
  assert.match(table, /<PageHeading text=\{title\} \/>/, "TableScene 应使用 <PageHeading>");
  assert.ok(
    !/fontWeight: FW\.heavy,\s*\n\s*color: C\.ink,\s*\n\s*fontFamily: FONT,/.test(table),
    "TableScene 不应再自绘标题",
  );
});

test("字幕条是整条胶囊 + 内嵌竖条，不再用两块拼出「把手」形状", () => {
  const caption = fs.readFileSync(path.join(process.cwd(), "render", "src", "components", "Caption.tsx"), "utf8");
  assert.match(caption, /borderRadius: RADIUS\.pill/, "字幕条应使用 RADIUS.pill");
  assert.ok(!caption.includes("999px 0 0"), "字幕条不应再用「左侧直块 + 右侧圆角」拼接");
});

test("间距/图标方块档位存在且被引用（防止各场景重新各自开档）", () => {
  const theme = read("shared/render/theme.ts");
  assert.match(theme, /export const SPACE = \{[^}]*xxl: 64/, "SPACE 应补齐到 xxl 档");
  assert.match(theme, /export const ICON_TILE = \{ sm: 44, md: 56, lg: 64 \}/, "图标方块应只剩三档尺寸");
  assert.match(theme, /export const tileShadow = /, "小元件投影应有统一令牌");
});

test("竖屏必须真的缩放字号：fs() 不能是恒等函数", () => {
  const src = read("shared/render/responsive.ts");
  // 曾经写死 fsScale = 1：1080 宽的竖屏套用 1920 宽设计的字号，
  // 结果 three_card 的文字溢出卡片、table 表头折成两行。
  const m = src.match(/const fsScale = isPortrait \? ([\d.]+) : 1;/);
  assert.ok(m, "fsScale 应按横竖屏取值，不要再用恒等函数");
  const portraitScale = Number(m![1]);
  assert.ok(portraitScale > 0.5 && portraitScale < 1, `竖屏字号缩放应在 (0.5, 1) 区间，当前 ${portraitScale}`);
  assert.match(src, /export const DESIGN_W = 1920/, "设计基准宽仍是 1920");
});

test("字幕字号独立于正文缩放（竖屏上前者要更大）", () => {
  const caption = fs.readFileSync(path.join(process.cwd(), "render", "src", "components", "Caption.tsx"), "utf8");
  assert.match(
    caption,
    /CAPTION_METRICS\.fontSize \* \(isPortrait \? 0\.92 : 1\)/,
    "字幕字号应单独按 0.92 缩放，不能跟着正文的 0.82 一起变小",
  );
  const responsive = read("shared/render/responsive.ts");
  assert.match(
    responsive,
    /const fSize = Math\.round\(m\.fontSize \* \(isPortrait \? 0\.92 : 1\)\)/,
    "字幕预留高度必须与字幕字号用同一口径，否则正文给字幕让位的空间会算错",
  );
});
