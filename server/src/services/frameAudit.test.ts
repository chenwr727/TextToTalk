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
  };
  auditVerdict: (m: never, w: number, h: number, portrait: boolean) => { level: string; message: string }[];
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
  const m = audit.measureInk(canvas(1000, [[100, 199], [800, 899]]), W, 1000);
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
  const holey = audit.measureInk(canvas(1000, [[100, 199], [800, 899]]), W, 1000);
  const v1 = audit.auditVerdict(holey as never, W, 1000, true);
  assert.ok(
    v1.some((v) => v.level === "warn" && v.message.includes("连续空白")),
    "600px 空洞必须 warn",
  );

  const sparse = audit.measureInk(canvas(1000, [[480, 519]]), W, 1000);
  const v2 = audit.auditVerdict(sparse as never, W, 1000, true);
  assert.ok(v2.every((v) => v.level === "info"), "稀疏不该 warn");
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
  assert.ok(Math.abs(banded.fill - (101 / 601)) < 0.001, "fill 相对正文带高度算");
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
