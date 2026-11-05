import assert from "node:assert/strict";
import test from "node:test";
import {
  auditElements,
  auditPresence,
  auditContent,
  auditNumbers,
  auditIcons,
  auditPairs,
  auditCaption,
  auditPrefix,
  auditOrder,
  measureTruncation,
  auditCaptionTiming,
  auditAudioDuration,
  auditSentenceCoverage,
  auditNarrationMatchesCaptions,
} from "./elementAudit";
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

/**
 * 回归：横屏地图页的卡片**整块没渲染**（不是被压扁，是根本没有）。
 *
 * 这是元素级判据唯一的盲区：没有盒子就没有东西可比。
 * 实测当时像素体检 72% / 0 告警，元素体检也 0 告警，只有看图才发现。
 * 现在由 `PageBody` 把"数据里有几条"写在 `data-expect` 上，探针回传后比对。
 */
test("auditPresence：数据里有 3 条，只画出 0 个文字块要告警", () => {
  const findings = auditPresence([box({ y: 240, h: 300, w: 1700, text: "三个部门的协作断点" })], 3, "map");
  assert.ok(
    findings.some((f) => f.level === "warn" && f.message.includes("元素缺失")),
    "数据 3 条、页面只有 1 块必须告警",
  );
  assert.match(findings[0].message, /3 条/);
});

test("auditPresence：块数够（含图例/地名等额外文字）不告警", () => {
  const findings = auditPresence(
    [
      box({ y: 240, h: 300, w: 1700, text: "三个部门的协作断点" }),
      box({ y: 640, h: 100, w: 800, text: "1产品 · 上海" }),
      box({ y: 750, h: 100, w: 800, text: "2研发 · 杭州" }),
      box({ y: 860, h: 60, w: 800, text: "3运营 · 成都" }),
    ],
    3,
    "map",
  );
  assert.deepEqual(findings, []);
});

test("auditPresence：单块内容和没有预期时不判数量", () => {
  assert.deepEqual(auditPresence([box({ text: "封面标题" })], 1), []);
  assert.deepEqual(auditPresence([box({ text: "封面标题" })], null), []);
});

test("auditContent：数据里的文案在页面上找不到要告警", () => {
  const boxes = [box({ y: 400, h: 80, w: 600, text: "低效的流程有三个信号" })];
  const findings = auditContent(boxes, ["流程的价值不在", "低效的流程"]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /文案没画出来/);
  assert.match(findings[0].message, /流程的价值不在/);
});

test("auditContent：文案都在（含空格差异）不告警", () => {
  const boxes = [
    box({ y: 400, h: 80, w: 600, text: "流程 的价值不在管住人" }),
    box({ y: 500, h: 80, w: 600, text: "低效的流程有三个信号" }),
  ];
  assert.deepEqual(auditContent(boxes, ["流程的价值不在", "低效的流程"]), []);
});

test("auditContent：没有预期文案时不判", () => {
  assert.deepEqual(auditContent([box({ text: "任意" })], []), []);
  assert.deepEqual(auditContent([box({ text: "任意" })], null), []);
});

test("auditNumbers：数字被改掉要告警（文案片段看不出这个）", () => {
  const boxes = [box({ y: 400, h: 80, w: 700, text: "自建 1,200元" })];
  const findings = auditNumbers(boxes, ["12000"]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /数字对不上/);
  assert.match(findings[0].message, /12000/);
});

test("auditNumbers：千分位与分开渲染不告警", () => {
  const boxes = [
    box({ y: 400, h: 80, w: 700, text: "12,000元" }),
    box({ y: 500, h: 80, w: 700, text: "3" }),
    box({ y: 600, h: 80, w: 700, text: "人" }),
  ];
  assert.deepEqual(auditNumbers(boxes, ["12000", "3"]), []);
});

test("auditIcons：图标 id 不认识（没渲染）要告警", () => {
  const findings = auditIcons([], ["rocket"]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /图标对不上/);
  assert.match(findings[0].message, /rocket/);
  assert.deepEqual(auditIcons(["rocket"], ["rocket"]), []);
  assert.deepEqual(auditIcons([], []), []);
});

test("auditPairs：数值张冠李戴（A 的数画到 B 那行）要告警", () => {
  // 正常：同一个行容器里同时有标签与数值
  const ok = [
    box({ y: 400, h: 60, w: 900, text: "自建 12,000元 3人" }),
    box({ y: 500, h: 60, w: 900, text: "采购 38,000元 1人" }),
  ];
  assert.deepEqual(
    auditPairs(ok, [
      { label: "自建", value: "12000" },
      { label: "采购", value: "38000" },
    ]),
    [],
  );
  // 错位：自建那行里写的是别人的数
  const swapped = [
    box({ y: 400, h: 60, w: 900, text: "自建 38,000元 3人" }),
    box({ y: 500, h: 60, w: 900, text: "采购 12,000元 1人" }),
  ];
  const findings = auditPairs(swapped, [
    { label: "自建", value: "12000" },
    { label: "采购", value: "38000" },
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /数值与标签没在一起/);
});

test("auditPairs：没有配对数据时不判", () => {
  assert.deepEqual(auditPairs([box({ text: "任意" })], []), []);
  assert.deepEqual(auditPairs([box({ text: "任意" })], null), []);
});

test("auditPairs：数值按完整数字比对，不能子串误伤（回归）", () => {
  /*
   * 踩过的坑：子串匹配把 `12000` 里的 `1`、`38000` 里的 `3` 当成“别人的数”，
   * 于是表格页 9 组全部误报。这里把那个场景固定下来。
   */
  const boxes = [
    box({ y: 400, h: 60, w: 900, text: "自建12,000元3人4个月" }),
    box({ y: 500, h: 60, w: 900, text: "采购38,000元1人1个月" }),
  ];
  assert.deepEqual(
    auditPairs(boxes, [
      { label: "自建", value: "12000" },
      { label: "自建", value: "3" },
      { label: "采购", value: "38000" },
      { label: "采购", value: "1" },
    ]),
    [],
  );
});

test("auditPairs：包住全部的容器不能让任何配对通过", () => {
  // 一个大盒子同时含两组的标签与数值：按“随便哪个盒子含就行”会假通过
  const boxes = [box({ y: 400, h: 300, w: 900, text: "自建38,000元 采购12,000元" })];
  const findings = auditPairs(boxes, [
    { label: "自建", value: "12000" },
    { label: "采购", value: "38000" },
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /数值与标签没在一起/);
});

test("auditCaption：显示不属于本页的字幕要告警", () => {
  const caps = ["审批链过长，决策被反复上推", "责任边界模糊"];
  assert.deepEqual(auditCaption("审批链过长，决策被反复上推", caps), []);
  // 截断显示（本页句子的前缀）不告警
  assert.deepEqual(auditCaption("审批链过长", caps), []);
  const bad = auditCaption("这是另一页的字幕", caps);
  assert.equal(bad.length, 1);
  assert.match(bad[0].message, /字幕对不上/);
  assert.deepEqual(auditCaption(null, caps), []);
  assert.deepEqual(auditCaption("任意", []), []);
});

test("auditPrefix：长文案被截断不告警，被改写要告警", () => {
  const long = "把审批链路上每个环节的等待时间单独统计出来，而不是只记总时长";
  // 截断：渲染文本是原文前缀
  assert.deepEqual(auditPrefix([long], ["把审批链路上每个环节的等待时间单独统计出来"]), []);
  // 改写：原文截断处之后接上别的字——渲染文本不再是原文前缀，要告警
  const bad = auditPrefix([long], ["把审批链路上每个环节的等待时间单独统计出来了啊"]);
  assert.equal(bad.length, 1);
  assert.match(bad[0].message, /长文案与原文对不上/);
  const worse = auditPrefix([long], ["完全不同的另一句长文案，足够长了吧真的"]);
  assert.equal(worse.length, 1);
  assert.match(worse[0].message, /长文案与原文对不上/);
  // 短文案不归它管
  assert.deepEqual(auditPrefix(["短句"], ["完全不同"]), []);
});

test("auditOrder：竖排要点顺序被互换要告警（字都对、数字都对）", () => {
  const order = ["先把流程画出来，标出所有环节", "再把等待时间单独统计出来", "最后按等待时间排序砍掉长尾"];
  const good = [
    box({ y: 300, h: 80, w: 800, text: order[0] }),
    box({ y: 450, h: 80, w: 800, text: order[1] }),
    box({ y: 600, h: 80, w: 800, text: order[2] }),
  ];
  assert.deepEqual(auditOrder(order, good), []);
  // 互换后两条：字不变，位置变
  const swapped = [
    box({ y: 300, h: 80, w: 800, text: order[0] }),
    box({ y: 450, h: 80, w: 800, text: order[2] }),
    box({ y: 600, h: 80, w: 800, text: order[1] }),
  ];
  const f = auditOrder(order, swapped);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /列表顺序和数据不一致/);
  // 多栏版式（左边界散开）不应告警
  const twoCol = [
    box({ y: 300, h: 80, w: 300, text: order[0] }),
    box({ y: 300, h: 80, w: 300, x: 700, text: order[1] }),
    box({ y: 600, h: 80, w: 300, text: order[2] }),
  ];
  assert.deepEqual(auditOrder(order, twoCol), []);
});

test("measureTruncation：算出被截掉的字数", () => {
  const long = "把审批链路上每个环节的等待时间单独统计出来";
  const info = measureTruncation([long], [box({ y: 300, h: 80, w: 800, text: "把审批链路上每个环节的等待时间" })]);
  assert.equal(info.count, 1);
  // 原文 31 字、画面显示 25 字 → 截掉 6 字
  assert.equal(info.hiddenChars, 6);
  // 没截断 → 0
  assert.deepEqual(measureTruncation([long], [box({ y: 300, h: 80, w: 800, text: long })]), {
    count: 0,
    hiddenChars: 0,
    samples: [],
  });
});

test("auditCaptionTiming：该说 B 却显 A 要告警（字幕都是本页的）", () => {
  const timing = [
    { seconds: 4, text: "第一句：审批链路卡在中间一层。" },
    { seconds: 4, text: "第二句：所以下层干脆绕着走。" },
  ];
  const fps = 30;
  // 第 1 句 = 0..120，第 2 句 = 120..240（gap=0）
  assert.deepEqual(auditCaptionTiming(timing[0].text, timing, 60, fps), []);
  assert.deepEqual(auditCaptionTiming(timing[1].text, timing, 180, fps), []);
  // 第 180 帧该说第二句，却显示第一句
  const f = auditCaptionTiming(timing[0].text, timing, 180, fps);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /字幕与口播错位/);
  // gap 区间不评价
  assert.deepEqual(auditCaptionTiming(timing[1].text, timing, 125, fps, 0.5), []);
  // 没有真实时长数据（只有 captions）就不核
  assert.deepEqual(auditCaptionTiming("任意", null, 60, fps), []);
});

test("auditAudioDuration：声明时长与真实音频差异要告警", () => {
  // 实测真实 e2e 产物：16 句声明与真实音频长度完全一致（0.00s 差）
  assert.deepEqual(
    auditAudioDuration([
      { text: "你写了三小时的周报", declared: 4.132, real: 4.13 },
      { text: "问题真不在你干得少", declared: 2.52, real: 2.52 },
    ]),
    [],
  );
  // 声音比声明长 1.4 秒 → 字幕提前切走
  const long = auditAudioDuration([{ text: "一句话", declared: 4.13, real: 5.56 }]);
  assert.equal(long.length, 1);
  assert.match(long[0].message, /字幕时长和真实音频对不上/);
  assert.match(long[0].message, /\+1\.43s/);
  // 声音比声明短 2.5 秒 → 字幕还挂着没人说
  const short = auditAudioDuration([{ text: "另一句", declared: 4.13, real: 1.6 }]);
  assert.match(short[0].message, /-2\.53s/);
  // 容差内不告警、拿不到音频也不告警
  assert.deepEqual(auditAudioDuration([{ text: "小偏差", declared: 4.0, real: 4.1 }]), []);
  assert.deepEqual(auditAudioDuration([{ text: "无音频", declared: 4.0, real: null }]), []);
});

test("auditSentenceCoverage：有字幕没配音要告警（TTS 部分失败只 warn）", () => {
  // 实测两份真实 e2e 产物（6 页 / 5 页）：captions 与 sentences 句数全部相等
  assert.deepEqual(auditSentenceCoverage(3, 3), []);
  assert.deepEqual(auditSentenceCoverage(0, 0), []);
  // sentences 比 captions 多不是错（不应告警）
  assert.deepEqual(auditSentenceCoverage(2, 3), []);
  // 少一句配音 → 那句没声音也不显示字幕
  const f = auditSentenceCoverage(4, 3);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /有 1 句没有配音/);
  assert.match(f[0].message, /字幕 4 句、配音 3 句/);
});

test("auditNarrationMatchesCaptions：口播稿与字幕分歧要告警", () => {
  // 实测真实 e2e 产物 11 页全部同一份
  const same = ["你写了三小时的周报。问题真不在你。", ["你写了三小时的周报。", "问题真不在你。"]] as const;
  assert.deepEqual(auditNarrationMatchesCaptions(same[0], same[1]), []);
  // 空白不算分歧
  assert.deepEqual(auditNarrationMatchesCaptions("第一句 第二句", ["第一句第", "二句"]), []);
  // 一个标点不一样也要报（实测用这个做反向验证）
  const f = auditNarrationMatchesCaptions("第一句。第二句", ["第一句？第二句"]);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /口播稿与字幕不是同一句话/);
  assert.match(f[0].message, /第 4 个字/);
  // 缺字段时不核（没必要报）
  assert.deepEqual(auditNarrationMatchesCaptions("", ["x"]), []);
  assert.deepEqual(auditNarrationMatchesCaptions("x", []), []);
});
