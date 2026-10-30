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

test("竖屏的横向流程图必须重排成竖列，而不是等比缩小", () => {
  const src = read("shared/render/scenes/CustomSvgScene.tsx");
  // 3.2:1 的流程示意图塞进 9:16 后，宽度用满 → 图形只有 ~200px 高（占画布 7%），
  // 再怎么调缩放都填不上，因为纵横比是死的。真正的解法是换组织方式。
  assert.match(src, /export function buildPortraitChain\(/, "竖屏重排逻辑应抽成可测试的纯函数 buildPortraitChain");
  assert.match(
    src,
    /isPortrait \? buildPortraitChain\(spec, portraitBand\)/,
    "竖屏要尝试把节点链竖排，而不是直接等比缩放",
  );
  assert.match(
    src,
    /chain \|\| pairs \|\| landCards \? \{ scale: 1, tx: 0, ty: 0 \} : computeFitTransform\(spec, safe\)/,
    "识别成链（含横屏重排）后不再叠加 fit 变换（坐标已是画布坐标）",
  );
  assert.match(src, /portraitSafeH\(spec, w, portraitBand\.h\)/, "识别不了链的复杂图必须退回等比缩放");
  // 复杂图放弃重排的三个闸门，少一个就会把多行图排错
  assert.match(src, /if \(cols\.length < 2 \|\| cols\.length > 4\) return null/, "列数超出范围应放弃重排");
  assert.match(src, /if \(cols\[c\]\.minX < cols\[c - 1\]\.maxX\) return null/, "列之间不允许重叠");
  // 复杂图放弃重排的闸门：节点太少/太多、列重叠、图元归类不了。
  // （read() 会剥掉注释，所以这里数 return null 的条数，而不是匹配注释文案）
  const gates = src.match(/return null;/g)?.length ?? 0;
  assert.ok(gates >= 4, `buildPortraitChain 应有 ≥4 个放弃重排的闸门，当前 ${gates}`);
});

test("横屏极端横图要能重排成一排大卡（不变形也不越界）", () => {
  const src = read("shared/render/scenes/CustomSvgScene.tsx");
  /*
   * 样例里那张流程图是 1700×264（≈6.4:1），等比塞进 1872×620 的带只能 264px 高，
   * 实测正文 378..642、下半截空 278px。解法是按节点数重画成等宽大卡。
   */
  assert.match(src, /export function buildLandscapeCards\(/, "横屏重排逻辑应是可测试的纯函数");
  assert.match(
    src,
    /if \(contentH >= landBand\.h \* 0\.55\) return null;/,
    "只有等比缩放后内容高度不足带高一半时才重排，否则保持 AI 原图",
  );
  assert.match(src, /const cardW = Math\.floor\(\(box\.w - \(N - 1\) \* ARROW_W\) \/ N\)/, "卡片宽度按正文带平分");
  assert.match(
    src,
    /const cardH = Math\.floor\(Math\.min\(box\.h \* 0\.92, cardW \* 1\.15\)\)/,
    "卡片高度受带高与宽度双重约束",
  );
});

test("竖屏的两行对照图要堆叠成「每行一对卡片」", () => {
  const src = read("shared/render/scenes/CustomSvgScene.tsx");
  /*
   * 2×2 对照图（样例 740×320）在竖屏只能按宽等比缩到 920×397，
   * 实测正文 692..1069（只占带的 26%）。它没法当链竖排（每列 2 个节点），
   * 但可以把「行」当堆叠单元：每行保留左→右配对，两行上下排。
   */
  assert.match(src, /export function buildPortraitPairRows\(/, "对照图重排应是可测试的纯函数");
  assert.match(
    src,
    /isPortrait && !chain \? buildPortraitPairRows\(spec, portraitBand\)/,
    "链识别不了时要试一下对照图重排",
  );
  assert.match(src, /if \(rows\.some\(\(r\) => r\.nodes\.length !== 2\)\) return null/, "每行必须恰好两个节点");
  assert.match(src, /const cardW = Math\.floor\(\(box\.w - ARROW_W\) \/ 2\)/, "每行两张卡片平分带宽");
  assert.match(src, /const rowH = Math\.floor\(\(box\.h - \(R - 1\) \* rowGap\) \/ R\)/, "行高按带高平分");
});

test("生成式版式要拿到现成的正文带", () => {
  /*
   * 只透传 portrait/width/height 时，AI 写的页面在竖屏上只占 884..1199（上下各空 800+）。
   * 把「已算好的正文目标盒子」透绩下去，它才能直接用 height 铺满；这条防的是接口被改回去。
   */
  const src = read("shared/render/code/GeneratedPage.tsx");
  assert.match(src, /useHeadingMetrics/);
  assert.match(src, /useCaptionReserve/);
  assert.match(src, /band=\{band\}/, "正文带要作为 prop 传给生成代码");
  assert.match(src, /bottom: Math\.round\(height - Math\.max\(captionReserve/, "带底要扣掉字幕预留");
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

/**
 * 竖屏流程图的箭头曾经整排消失。
 *
 * FlowScene 的 `showArrow = i < n-1 && (i+1) % perRow !== 0` 是给横排去尾用的；竖屏
 * `perRow` 恒为 1，`(i+1)%1` 恒等于 0 —— 于是一条箭头都不画，三张卡堆成三块无关的
 * 色块，"flow"这个语义彻底丢了（实测帧里卡片之间干干净净）。箭头必须按方向分别判断。
 */
test("竖屏 flow 也要画箭头，且画在卡片下方而不是右侧", () => {
  const src = read("shared/render/scenes/SmartArt.tsx");
  assert.match(
    src,
    /const showArrow = i < n - 1 && \(isPortrait \|\| \(i \+ 1\) % perRow !== 0\)/,
    "竖屏又把箭头关了（perRow=1 时会全部被截断），卡片之间不再有流向",
  );
  assert.match(
    src,
    /isPortrait\s*\? \{ left: 0, right: 0, top: "100%", height: ROW_GAP \}/,
    "竖屏箭头必须落在卡片下方的行间距里",
  );
});

/**
 * 竖屏一列卡片的宽度上限。
 *
 * 原来 MAX_NODE_W 写死 sp(560)≈476，而内容区有 952 —— 卡片只用一半宽、却吃满行高，
 * 三张"又窄又高的长方体"，文字在中间一小团（实测卡片 x 305..780、高 470）。
 */
test("竖屏流程卡片宽度要用满内容区", () => {
  const src = read("shared/render/scenes/SmartArt.tsx");
  assert.match(src, /const MAX_NODE_W = isPortrait \? Math\.max\(MIN_NODE_W, availW\) : 560/);
});
