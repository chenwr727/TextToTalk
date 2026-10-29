import { test } from "node:test";
import assert from "node:assert/strict";
import * as auditNs from "./frameAudit";

/**
 * 墨迹审计的纯函数。
 *
 * 这套指标是这一轮"量真片"临时写出来后固化的：它抓到过一个 bbox 填充率 65%、
 * 但页面中间有 620px 空洞的 quote 页。所以这里重点钉两件事——
 * bbox 内空洞能被测出来，以及"稀疏"和"空洞"是两回事。
 */
type AuditModule = {
  measureInk: (
    gray: Uint8Array,
    w: number,
    h: number,
    opts?: { threshold?: number; bgCols?: number; band?: { top: number; bottom: number } },
  ) => {
    fill: number;
    voidPx: number;
    voidAt: number;
    inkRatio: number;
    inkTop: number;
    inkBottom: number;
    inkLeft: number;
    inkRight: number;
    structTop: number;
    structBottom: number;
    structVoidPx: number;
    structVoidAt: number;
  };
  auditVerdict: (
    m: never,
    w: number,
    h: number,
    portrait: boolean,
    opts?: { layout?: string; band?: { top: number; bottom: number } },
  ) => { level: string; message: string }[];
  AIRY_LAYOUTS: ReadonlySet<string>;
};
const audit = ((auditNs as unknown as { default?: AuditModule }).default ?? auditNs) as unknown as AuditModule;

const W = 100;
/** 造一张背景 250 的灰度图，并在指定行区间填上 40 的"墨迹" */
function canvas(h: number, blocks: [number, number][], ink = 40, bg = 250): Uint8Array {
  const g = new Uint8Array(W * h).fill(bg);
  for (const [from, to] of blocks) {
    for (let y = from; y <= to; y++) for (let x = 10; x < W - 10; x++) g[y * W + x] = ink;
  }
  return g;
}

test("measureInk：空白画面没有任何墨迹", () => {
  const m = audit.measureInk(new Uint8Array(W * 200).fill(250), W, 200);
  assert.equal(m.fill, 0);
  assert.equal(m.voidPx, 0);
});

test("measureInk：单块内容只占它自己的高度", () => {
  const m = audit.measureInk(canvas(1000, [[450, 549]]), W, 1000);
  assert.equal(m.inkTop, 450);
  assert.equal(m.inkBottom, 549);
  assert.equal(m.fill, 0.1);
  // 空白全在 bbox 之外，不算"内部空洞"
  assert.equal(m.voidPx, 0);
});

test("measureInk：两块内容之间的空白被记为内部空洞", () => {
  const m = audit.measureInk(
    canvas(1000, [
      [100, 199],
      [800, 899],
    ]),
    W,
    1000,
  );
  assert.equal(m.fill, 0.8, "bbox 从 100 到 899，占 80%");
  assert.equal(m.voidPx, 600, "200..799 共 600 行空白");
  assert.equal(m.voidAt, 200);
});

test("measureInk：稀疏但连续的页面 voidPx 是 0，只有 fill 低", () => {
  // 一句话居中：fills 很低，但没有洞
  const m = audit.measureInk(canvas(1000, [[480, 519]]), W, 1000);
  assert.equal(m.fill, 0.04);
  assert.equal(m.voidPx, 0);
});

test("measureInk：墨迹看不见的浅色卡片，靠「竖向台阶」也能算出结构行起始位置", () => {
  /*
   * 真实版面里卡片是 #fff、背景是浅灰，灰度差只有 2~6，墨迹阈值 45 完全看不见。
   * 这时墨迹口径会以为正文从卡内文字才开始（实测 points 页：卡顶 y=250、文字 y=410），
   * 结构口径靠"相邻两行同列出现明显台阶"把卡顶找回来。
   */
  const h = 700;
  const g = new Uint8Array(W * h).fill(250);
  for (let y = 300; y <= 600; y++) for (let x = 10; x < W - 10; x++) g[y * W + x] = 240; // 卡面：差 10，不是墨迹
  for (let y = 480; y <= 499; y++) for (let x = 10; x < W - 10; x++) g[y * W + x] = 40; // 卡内文字
  const m = audit.measureInk(g, W, h, { band: { top: 200, bottom: 690 } });
  assert.equal(m.inkTop, 480, "墨迹口径只能看到文字");
  assert.equal(m.structTop, 300, "结构口径能看到卡顶");
  // 台阶记在「变化之后的那一行」：300 从背景变卡面，601 从卡面变回背景
  assert.equal(m.structBottom, 601, "卡底同样是台阶");
  assert.ok(m.structVoidPx > 0, "卡面内部既无墨迹也无台阶，仍会被记为空白（所以它只做诊断）");
});

test("measureInk：按行取背景，竖向渐变不会被当成墨迹", () => {
  // 整幅从上到下 250 -> 120 的渐变，没有任何"内容"
  const g = new Uint8Array(W * 300);
  for (let y = 0; y < 300; y++) {
    const v = Math.round(250 - (130 * y) / 299);
    for (let x = 0; x < W; x++) g[y * W + x] = v;
  }
  const m = audit.measureInk(g, W, 300);
  assert.equal(m.fill, 0, "逐行估背景，渐变不该被判成墨迹");
});

test("measureInk：阈值决定弱对比内容算不算墨迹", () => {
  const weak = canvas(200, [[80, 119]], 235);
  assert.equal(audit.measureInk(weak, W, 200, { threshold: 26 }).fill, 0);
  assert.ok(audit.measureInk(weak, W, 200, { threshold: 12 }).fill > 0);
});

test("measureInk：inkRatio 反映 bbox 内的密度", () => {
  const full = audit.measureInk(canvas(200, [[50, 149]]), W, 200);
  // 左右各留 10px 背景，所以密度略小于 1
  assert.ok(full.inkRatio > 0.75 && full.inkRatio < 0.85, `实测 ${full.inkRatio}`);
});

test("auditVerdict：内部空洞超过正文带 15% 要报警，稀疏只提示", () => {
  const holey = audit.measureInk(
    canvas(1000, [
      [100, 199],
      [800, 899],
    ]),
    W,
    1000,
  );
  const v1 = audit.auditVerdict(holey as never, W, 1000, true);
  assert.ok(
    v1.some((v) => v.level === "warn" && v.message.includes("连续空白")),
    "600px 空洞必须 warn",
  );

  const sparse = audit.measureInk(canvas(1000, [[480, 519]]), W, 1000);
  const v2 = audit.auditVerdict(sparse as never, W, 1000, true);
  assert.ok(
    v2.every((v) => v.level === "info"),
    "稀疏不该 warn",
  );
});

test("auditVerdict：天生稀疏的版式（封面/章节/收尾）不再提示稀疏，但没渲染出来仍要报警", () => {
  // 封面实测 fill 24%、内部空洞 87px —— 改之前会吐一条"内容只占 24%"的 info
  const cover = audit.measureInk(canvas(1000, [[400, 639]]), W, 1000);
  assert.ok(Math.abs(cover.fill - 0.24) < 0.005, "造出来的 fill 应是 24%");
  const none = audit.auditVerdict(cover as never, W, 1000, true, { layout: "title" });
  assert.equal(none.length, 0, "封面留白是设计的一部分，不该再提示");

  // 同一张图，换成普通内容页就该提示稀疏
  const regular = audit.auditVerdict(cover as never, W, 1000, true, { layout: "points" });
  assert.ok(
    regular.some((v) => v.level === "info" && v.message.includes("上下留白")),
    "内容页 24% 仍要提示",
  );

  // 封面只有 5% 说明标题根本没出来
  const broken = audit.measureInk(canvas(1000, [[480, 529]]), W, 1000);
  const v = audit.auditVerdict(broken as never, W, 1000, true, { layout: "title" });
  assert.ok(
    v.some((x) => x.level === "warn" && x.message.includes("没渲染出来")),
    "稀疏页低于 15% 必须是 warn",
  );
});

test("auditVerdict：稀疏版式的空洞上限放宽到 25%，但大断层仍然报警", () => {
  // 标题在 300..339、要点在 700..739：中间 360px 空白 = 正文带 47% > 25%
  const gap = audit.measureInk(
    canvas(1000, [
      [300, 339],
      [700, 739],
    ]),
    W,
    1000,
  );
  const v = audit.auditVerdict(gap as never, W, 1000, true, { layout: "end" });
  assert.ok(
    v.some((x) => x.level === "warn" && x.message.includes("连续空白")),
    "47% 的洞即便在收尾页也要报",
  );

  // 空洞比例是相对"正文带"算的，不是整幅图：100×1000 走竖屏带 109..880（772px），
  // 所以 180px 空白 = 23%，低于放宽后的 25%
  const ok = audit.measureInk(
    canvas(1000, [
      [300, 339],
      [520, 559],
    ]),
    W,
    1000,
  );
  const v2 = audit.auditVerdict(ok as never, W, 1000, true, { layout: "end" });
  assert.equal(v2.length, 0, "180px/772px = 23% 的洞在收尾页允许");
});

test("robustSpread：五个采样点取中段，一帧装饰跳变不抬高离散度", () => {
  const spreadOf = (auditNs as unknown as { robustSpread: (f: number[]) => number }).robustSpread;
  // 实测 chart 页的五点：71/71/71/77/71（%）—— 最后一个 77 是装饰引起的跳变
  assert.equal(spreadOf([0.71, 0.71, 0.71, 0.77, 0.71]), 0, "中段一致，应报 0pp");
  // 真的不稳定（12s 页在 30% 采样时还在入场动画里：89/71/71% + 两个稳定值）
  assert.equal(spreadOf([0.89, 0.71, 0.71, 0.72, 0.71]), 1, "只剩一个异常点时中段仍稳");
  assert.equal(spreadOf([0.89, 0.85, 0.71, 0.66, 0.55]), 19, "整体下降必须报出来");
  assert.equal(spreadOf([0.5, 0.9]), 40, "只有两个点时退回极差");
  assert.equal(spreadOf([0.66, 0.71, 0.77]), 11, "三个点也是极差");
});

test("AIRY_LAYOUTS：只登记封面/章节/收尾三页", () => {
  assert.deepEqual([...(audit.AIRY_LAYOUTS as ReadonlySet<string>)].sort(), ["end", "section", "title"]);
});

test("measureInk：band 之外的内容不参与判断（页标题/字幕条不算内容）", () => {
  // 页标题在 y=20..80、字幕条在 y=900..960，正文带取 200..800
  const g = canvas(1000, [
    [20, 80],
    [400, 500],
    [900, 960],
  ]);
  const full = audit.measureInk(g, W, 1000);
  assert.equal(full.inkTop, 20);
  assert.equal(full.inkBottom, 960);
  assert.ok(full.voidPx > 300, "不裁带时，标题与正文、正文与字幕之间都是洞");

  const banded = audit.measureInk(g, W, 1000, { band: { top: 200, bottom: 800 } });
  assert.equal(banded.inkTop, 400, "标题被排除");
  assert.equal(banded.inkBottom, 500, "字幕条被排除");
  assert.equal(banded.voidPx, 0, "正文带内没有洞");
  assert.ok(Math.abs(banded.fill - 101 / 601) < 0.001, "fill 相对正文带高度算");
});

test("bodyBand：竖屏与横屏各给出不含标题/字幕的正文带", () => {
  const bandOf = (auditNs as unknown as { bodyBand: (w: number, h: number) => { top: number; bottom: number } })
    .bodyBand;
  const p = bandOf(1080, 1920);
  assert.deepEqual(p, { top: 209, bottom: 1690 }, "竖屏与实际成片对齐（字幕条顶边 y≈1690）");
  const l = bandOf(1920, 1080);
  assert.equal(l.top, 200);
  assert.ok(l.bottom > 900 && l.bottom < 940, `横屏字幕条在 y≈929，实测 ${l.bottom}`);
});
