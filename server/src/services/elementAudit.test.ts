import assert from "node:assert/strict";
import test from "node:test";
import { auditElements } from "./elementAudit";
import type { ElementBox } from "../../render/src/shared/render/elementGeometry";

const box = (o: Partial<ElementBox>): ElementBox => ({
  tag: "div",
  text: "文字",
  x: 0,
  y: 0,
  w: 100,
  h: 40,
  fontSize: 20,
  scrollW: 100,
  scrollH: 40,
  clientW: 100,
  clientH: 40,
  abs: false,
  clip: false,
  ...o,
});

const OPTS = { width: 1080, height: 1920, bandTop: 209, bandBottom: 1690 };

test("auditElements：正常页面没有意见", () => {
  const findings = auditElements([box({ y: 300 }), box({ y: 400 }), box({ y: 500 })], OPTS);
  assert.deepEqual(findings, []);
});

test("auditElements：文字被容器裁掉要告警（scrollH > clientH）", () => {
  const findings = auditElements(
    [box({ y: 300, h: 40, clientH: 40, scrollH: 92, clip: true, text: "三段话被裁成两行" })],
    OPTS,
  );
  assert.ok(
    findings.some((f) => f.level === "warn" && f.message.includes("文字被裁")),
    "裁字必须 alarming",
  );
});

test("auditElements：块被压扁要告警（块高 < 字号）", () => {
  // 横屏地图卡片被压到 17px 高、字号 34 —— 看起来像"卡片不见了"，但像素体检 72% / 0 告警
  const findings = auditElements(
    [box({ y: 816, h: 17, clientH: 17, scrollH: 17, fontSize: 34, clip: true, text: "产品 · 上海" })],
    { ...OPTS, bandBottom: 920 },
  );
  assert.ok(
    findings.some((f) => f.level === "warn" && f.message.includes("块被压扁")),
    "压扁必须告警",
  );
});

test("auditElements：两块内容大面积重叠要告警，父子包含不算", () => {
  const overlap = auditElements(
    [box({ y: 300, x: 100, w: 300, h: 120, text: "胶囊" }), box({ y: 320, x: 100, w: 300, h: 120, text: "大字" })],
    OPTS,
  );
  assert.ok(
    overlap.some((f) => f.level === "warn" && f.message.includes("两块内容重叠")),
    "重叠必须告警",
  );

  const nested = auditElements(
    [box({ y: 300, x: 100, w: 400, h: 200, text: "卡片" }), box({ y: 320, x: 120, w: 360, h: 160, text: "卡内文字" })],
    OPTS,
  );
  assert.equal(nested.filter((f) => f.message.includes("重叠")).length, 0, "父容器包住子元素不是重叠");
});

test("auditElements：两个绝对定位块互相叠放只提示，不告警", () => {
  const findings = auditElements(
    [
      box({ y: 300, x: 100, w: 300, h: 120, abs: true, text: "贴片" }),
      box({ y: 310, x: 110, w: 300, h: 120, abs: true, text: "角标" }),
    ],
    OPTS,
  );
  assert.ok(findings.some((f) => f.level === "info" && f.message.includes("绝对定位元素重叠")));
  assert.equal(findings.filter((f) => f.level === "warn").length, 0);
});

test("auditElements：越过正文带底 / 压到字幕要告警", () => {
  const overBand = auditElements([box({ y: 1600, h: 200 })], OPTS);
  assert.ok(overBand.some((f) => f.level === "warn" && f.message.includes("越过下边界")));

  // 横屏地图那次：卡片底 945，字幕顶 927 —— 差 18px 也会被字幕条压住
  const overCaption = auditElements([box({ y: 850, h: 95 })], {
    width: 1920,
    height: 1080,
    bandTop: 200,
    bandBottom: 920,
    captionTop: 927,
  });
  assert.ok(
    overCaption.some((f) => f.level === "warn" && f.message.includes("越过下边界")),
    "压到字幕也要报",
  );
});

test("auditElements：空列表直接返回", () => {
  assert.deepEqual(auditElements([], OPTS), []);
});

/**
 * 回归：横屏地图页的真实 bug。
 *
 * 三张地标卡按 86px 估高（实际 102px），第 3 张底边落到 945，
 * 而字幕条上沿在 927 —— 观众看到「运营 · 成都」被字幕压住。
 * 当时像素体检报 fill 100% / 0 告警，只有看图才发现。
 * 这条守住"越界"判据不被后来的人调松。
 */
test("auditElements：横屏地图的卡片溢出被字幕压住（真实回归）", () => {
  const findings = auditElements(
    [
      box({ y: 240, h: 370, w: 1720, text: "三个部门的协作断点", fontSize: 16 }),
      box({ y: 634, h: 102, w: 1720, text: "1产品 · 上海" }),
      box({ y: 746, h: 102, w: 1720, text: "2研发 · 杭州" }),
      box({ y: 860, h: 85, w: 1720, text: "3运营 · 成都" }),
    ],
    { width: 1920, height: 1080, bandTop: 200, bandBottom: 920, captionTop: 927 },
  );
  const hit = findings.find((f) => f.level === "warn" && f.message.includes("越过下边界"));
  assert.ok(hit, "卡片底 945 > 字幕顶 927 必须告警");
  assert.match(hit.message, /945/);
});

/**
 * 回归：四象限页的胶囊盖在大字上（真实 bug，两块是兄弟、互不包含）。
 * 像素体检报 93% fill / 0 告警，同样是看图才发现。
 */
test("auditElements：四象限的胶囊压在大字上（真实回归）", () => {
  const findings = auditElements(
    [
      box({ y: 600, x: 100, w: 420, h: 110, text: "重要 · 不紧急" }),
      box({ y: 606, x: 100, w: 420, h: 110, text: "设备领用" }),
    ],
    OPTS,
  );
  assert.ok(
    findings.some((f) => f.level === "warn" && f.message.includes("两块内容重叠")),
    "两块兄弟内容大面积重叠必须告警",
  );
});
