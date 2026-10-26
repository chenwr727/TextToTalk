import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  STRUCTURAL_LAYOUTS,
  captionOverlap,
  captionOverlapInfo,
  collectStoryboardWarnings,
  extractJson,
  normalizeArt,
  normalizeDirect,
  normalizeEffects,
  normalizeIcon,
  normalizeLayout,
  normalizeMotion,
  normalizePage,
  normalizeRhythm,
  normalizeRole,
  normalizeTransition,
  parseJson,
  parsePlan,
  validatePageContent,
  validatePlan,
} from "./normalize.js";
import type { StoryPage } from "../types.js";

/**
 * normalize 层是「LLM 输出 → 强类型分镜」的唯一收口。
 * 它的输入永远不可信（模型可能返回多个 JSON、缺字段、枚举写错、数值越界），
 * 所以这里按「真实失败样本」逐条钉死行为，防止后续改动悄悄放宽约束。
 */

describe("extractJson / parseJson", () => {
  test("剥掉 markdown 代码块后正确解析", () => {
    const raw = '```json\n{"pages":[{"idea":"开场"}]}\n```';
    assert.deepEqual(parseJson(raw), { pages: [{ idea: "开场" }] });
  });

  test("容忍 JSON 前后的解释性文字", () => {
    assert.deepEqual(parseJson('好的，结果如下：{"a":1} 以上。'), { a: 1 });
  });

  test("模型一次返回多个 JSON 对象时只取第一个", () => {
    assert.deepEqual(parseJson('{"a":1}{"b":2}'), { a: 1 });
  });

  test("嵌套对象与字符串里的花括号不影响括号配对", () => {
    assert.deepEqual(parseJson('{"a":{"b":"}"}}'), { a: { b: "}" } });
  });

  test("完全无法解析时回落为空 pages，而不是抛错", () => {
    assert.deepEqual(parseJson("模型这次什么都没给"), { pages: [] });
  });

  test("extractJson 在无 JSON 时原样返回文本", () => {
    assert.equal(extractJson("没有大括号"), "没有大括号");
  });

  test("parsePlan 解析失败时回落为空 pages", () => {
    assert.deepEqual(parsePlan("oops"), { pages: [] });
    assert.deepEqual(parsePlan('{"pages":[{"layout":"title"}]}'), { pages: [{ layout: "title" }] });
  });
});

describe("枚举归一化：越界值必须收敛到安全默认", () => {
  test("layout 非法值收敛为 points", () => {
    assert.equal(normalizeLayout("map"), "map");
    // "mechanism" 是 role 的取值，被误写到 layout 时必须收敛
    assert.equal(normalizeLayout("mechanism"), "points");
    assert.equal(normalizeLayout(undefined), "points");
  });

  test("role / icon 非法值收敛为 null", () => {
    assert.equal(normalizeRole("compare"), "compare");
    assert.equal(normalizeRole("points"), null);
    assert.equal(normalizeIcon("rocket"), "rocket");
    assert.equal(normalizeIcon("flame"), null);
  });

  test("rhythm / transition / motion 非法值收敛为默认", () => {
    assert.equal(normalizeRhythm("dense"), "dense");
    assert.equal(normalizeRhythm("fast"), "anchor");
    assert.equal(normalizeTransition("slide-right"), "slide-right");
    assert.equal(normalizeTransition("wipe"), "fade");
    assert.equal(normalizeMotion("float"), "float");
    assert.equal(normalizeMotion("bounce"), "spring");
  });

  test("art 只接受 Art 联合类型内的 5 个值（pyramid 属于 chart，不是 art）", () => {
    assert.equal(normalizeArt("loop"), "loop");
    assert.equal(normalizeArt("pyramid"), null);
    assert.equal(normalizeArt("mindmap"), null);
  });

  test("effects 只保留合法枚举与布尔真值", () => {
    const e = normalizeEffects({ annotation: "underline", pathDraw: true, threeD: "yes" });
    assert.equal(e.annotation, "underline");
    assert.equal(e.pathDraw, true);
    assert.equal(e.threeD, undefined);

    const none = normalizeEffects({ annotation: "none" });
    assert.equal(none.annotation, undefined);

    const empty = normalizeEffects(null);
    assert.equal(empty.annotation, undefined);
    assert.equal(empty.pathDraw, undefined);
    assert.equal(empty.threeD, undefined);
  });

  test("STRUCTURAL_LAYOUTS 覆盖所有承载结构的版式", () => {
    for (const layout of ["steps", "two_column", "comparison", "three_card", "chart", "table", "map", "stats", "qa"]) {
      assert.ok(STRUCTURAL_LAYOUTS.has(layout), `${layout} 应属于结构版式`);
    }
    assert.ok(!STRUCTURAL_LAYOUTS.has("points"));
    assert.ok(!STRUCTURAL_LAYOUTS.has("title"));
  });
});

describe("validatePlan：大纲级校验", () => {
  test("首尾页版式不合法时报错", () => {
    const problems = validatePlan({ pages: [{ layout: "points" }, { layout: "points" }] });
    assert.ok(
      problems.some((p) => p.includes('第1页 layout="points"')),
      problems.join("|"),
    );
    assert.ok(
      problems.some((p) => p.includes("最后一页")),
      problems.join("|"),
    );
  });

  test("start=title + end 的合法大纲无问题", () => {
    assert.deepEqual(validatePlan({ pages: [{ layout: "title" }, { layout: "end" }] }), []);
  });

  test("chart=true 与 layout 不一致时报错", () => {
    const problems = validatePlan({
      pages: [{ layout: "title" }, { layout: "points", chart: true }, { layout: "end" }],
    });
    assert.ok(
      problems.some((p) => p.includes("chart=true 但 layout")),
      problems.join("|"),
    );
  });

  test("visual 描述了三个并列卡片却没给 three_card 时报错", () => {
    const problems = validatePlan({
      pages: [{ layout: "title" }, { layout: "points", visual: "三个并列卡片" }, { layout: "end" }],
    });
    assert.ok(
      problems.some((p) => p.includes("three_card")),
      problems.join("|"),
    );
  });

  test("空或缺失 pages 时不抛错", () => {
    assert.deepEqual(validatePlan({}), []);
    assert.deepEqual(validatePlan(null as never), []);
  });
});

describe("normalizePage：单页归一化", () => {
  test("缺省字段补齐为可渲染的默认值", () => {
    const page = normalizePage({ title: "标题", captions: ["甲", "乙"], narration: "旁白" }, 0);
    assert.equal(page.pageIndex, 0);
    assert.equal(page.layout, "points");
    assert.equal(page.role, null);
    assert.equal(page.icon, null);
    assert.equal(page.rhythm, "anchor");
    assert.equal(page.transition, "fade");
    assert.equal(page.motion, "spring");
    assert.deepEqual(page.captions, ["甲", "乙"]);
    assert.ok(page.durationSec >= 3);
  });

  test("标题截断到 24 字，要点截断到 10 条", () => {
    const page = normalizePage(
      {
        title: "一二三四五六七八九十一二三四五六七八九十一二三四五六七八",
        points: Array.from({ length: 14 }, (_, i) => `要点${i}`),
      },
      0,
    );
    assert.equal(page.title.length, 24);
    assert.equal(page.points.length, 10);
  });

  test("captions 缺失时按标点从句柄旁白切分", () => {
    const page = normalizePage({ narration: "第一句。第二句！第三句？" }, 0);
    assert.deepEqual(page.captions, ["第一句。", "第二句！", "第三句？"]);
  });

  test("narration 缺失时回落到 captions 拼接", () => {
    const page = normalizePage({ captions: ["甲", "乙"] }, 0);
    assert.equal(page.narration, "甲乙");
  });

  test("封面/结尾页丢弃 customSvg（渲染端不会绘制）", () => {
    const svg = [{ type: "circle", cx: 100, cy: 100, r: 10 }];
    assert.equal(normalizePage({ customSvg: svg }, 0, "title").customSvg, null);
    assert.equal(normalizePage({ customSvg: svg }, 0, "end").customSvg, null);
  });

  test("结构版式与 customSvg 冲突时降级为 points，并清空 art", () => {
    const page = normalizePage({ customSvg: [{ type: "circle", cx: 100, cy: 100, r: 10 }] }, 1, "steps");
    assert.equal(page.layout, "points");
    assert.equal(page.art, null);
    assert.ok(Array.isArray(page.customSvg));
  });

  test("customSvg 的 y 坐标越界被压回安全区（≤780）", () => {
    const page = normalizePage({ customSvg: [{ type: "circle", cx: 100, cy: 1050, r: 10 }] }, 1);
    assert.equal((page.customSvg as { cy: number }[])[0].cy, 780);
  });
});

describe("normalizePage：chart / table / map", () => {
  test("labels 与 values 长度不一致的图表直接作废", () => {
    const page = normalizePage({ chart: { type: "bar", labels: ["甲", "乙"], values: [1] } }, 1);
    assert.equal(page.chart, null);
  });

  test("图表标题缺省为「对比」，数据截断到 6 项", () => {
    const page = normalizePage(
      { chart: { type: "pie", labels: ["a", "b", "c", "d", "e", "f", "g"], values: [1, 2, 3, 4, 5, 6, 7] } },
      1,
    );
    assert.equal(page.chart?.type, "pie");
    assert.equal(page.chart?.title, "对比");
    assert.equal(page.chart && "labels" in page.chart ? page.chart.labels.length : -1, 6);
  });

  test("scatter 只给 points、没有 labels/values 时也能通过（回归：曾被通用校验误判为空）", () => {
    const page = normalizePage(
      {
        chart: {
          type: "scatter",
          points: [
            { x: 1, y: 2 },
            { x: 4, y: 5, label: "甲" },
          ],
        },
      },
      1,
    );
    assert.equal(page.chart?.type, "scatter");
    assert.equal(page.chart && "points" in page.chart ? page.chart.points.length : -1, 2);
  });

  test("scatter 少于 2 个点作废", () => {
    assert.equal(normalizePage({ chart: { type: "scatter", points: [{ x: 1, y: 2 }] } }, 1).chart, null);
  });

  test("scatter 非数值点被过滤", () => {
    const page = normalizePage(
      {
        chart: {
          type: "scatter",
          points: [
            { x: 1, y: 2 },
            { x: "x", y: 3 },
            { x: 4, y: 5, label: "甲" },
          ],
        },
      },
      1,
    );
    assert.equal(page.chart?.type, "scatter");
    assert.equal(page.chart && "points" in page.chart ? page.chart.points.length : -1, 2);
  });

  test("stacked-bar 只给 series、没有顶层 values 时也能通过（回归）", () => {
    const page = normalizePage(
      {
        chart: {
          type: "stacked-bar",
          labels: ["甲", "乙"],
          series: [
            { name: "A", values: [1, 2] },
            { name: "B", values: [3, 4] },
          ],
        },
      },
      1,
    );
    assert.equal(page.chart?.type, "stacked-bar");
    assert.equal(page.chart && "series" in page.chart ? page.chart.series.length : -1, 2);
  });

  test("stacked-bar 缺少合法 series 时作废", () => {
    const page = normalizePage({ chart: { type: "stacked-bar", labels: ["a", "b"], values: [1, 2], series: [] } }, 1);
    assert.equal(page.chart, null);
  });

  test("stacked-bar 中与 labels 长度不符的系列被丢弃", () => {
    const page = normalizePage(
      {
        chart: {
          type: "stacked-bar",
          labels: ["甲", "乙"],
          series: [
            { name: "合法", values: [1, 2] },
            { name: "长度不符", values: [1] },
          ],
        },
      },
      1,
    );
    assert.equal(page.chart && "series" in page.chart ? page.chart.series.length : -1, 1);
  });

  test("表格行按表头宽度对齐，宽度不符的行被丢弃", () => {
    const page = normalizePage({ table: { headers: ["甲", "乙"], rows: [["a", "b", "c"], ["d"]] } }, 1);
    assert.deepEqual(page.table, { headers: ["甲", "乙"], rows: [["a", "b"]] });
  });

  test("表格缺 headers/rows 时作废", () => {
    assert.equal(normalizePage({ table: { headers: [] } }, 1).table, null);
  });

  test("地图标记点坐标越界被丢弃", () => {
    const page = normalizePage(
      {
        map: {
          markers: [
            { name: "越界", x: 2000, y: 300 },
            { name: "上海", x: 900, y: 500 },
          ],
        },
      },
      1,
    );
    assert.equal(page.map?.markers?.length, 1);
    assert.equal(page.map?.markers?.[0].name, "上海");
  });

  test("地图路线首尾相同或下标越界的被丢弃", () => {
    const page = normalizePage(
      {
        map: {
          markers: [
            { name: "A", x: 10, y: 10 },
            { name: "B", x: 20, y: 20 },
          ],
          routes: [
            { from: 0, to: 0 },
            { from: 0, to: 1 },
            { from: 0, to: 9 },
          ],
        },
      },
      1,
    );
    assert.equal(page.map?.routes?.length, 1);
  });
});

describe("normalizeDirect：兜底直出", () => {
  test("最多保留 10 页且补全 projectTitle", () => {
    const sb = normalizeDirect({ pages: Array.from({ length: 13 }, (_, i) => ({ title: `p${i}` })) });
    assert.equal(sb.pages.length, 10);
    assert.equal(sb.projectTitle, "我的讲解");
  });

  test("pages 不是数组时返回空分镜", () => {
    assert.deepEqual(normalizeDirect({}).pages, []);
  });
});

describe("captionOverlapInfo：字幕/要点查重", () => {
  test("完全相同的长句重合度为 1", () => {
    const info = captionOverlapInfo("人工智能正在改变制造业的生产方式", "人工智能正在改变制造业的生产方式");
    assert.equal(info.ratio, 1);
    assert.ok(info.inter >= 4);
  });

  test("有效字过少时不做判断（避免误报）", () => {
    assert.deepEqual(captionOverlapInfo("是的就是", "是的就是"), { ratio: 0, inter: 0 });
  });

  test("无关内容重合度低", () => {
    assert.ok(captionOverlap("人工智能正在改变制造业", "晴天气温回升适合郊游") < 0.5);
  });
});

describe("validatePageContent：单页内容校验", () => {
  const build = (raw: Record<string, unknown>, index = 1): StoryPage => normalizePage(raw, index);

  test("正常封面无告警", () => {
    assert.deepEqual(validatePageContent(build({ captions: ["开场"], narration: "一句话点题。" }, 0)), []);
  });

  test("封面字幕超过 2 条报「信息过载」", () => {
    const problems = validatePageContent(build({ captions: ["一", "二", "三"] }, 0));
    assert.ok(
      problems.some((p) => p.includes("封面页信息过载")),
      problems.join("|"),
    );
  });

  test("three_card 要点不是恰好 3 个时报错", () => {
    const problems = validatePageContent(build({ layout: "three_card", points: ["a", "b"] }));
    assert.ok(
      problems.some((p) => p.includes("three_card")),
      problems.join("|"),
    );
  });

  test("comparison 要点为奇数时报错", () => {
    const problems = validatePageContent(build({ layout: "comparison", points: ["a", "b", "c"] }));
    assert.ok(
      problems.some((p) => p.includes("奇数")),
      problems.join("|"),
    );
  });

  test("comparison 两侧条数不等时报错", () => {
    const problems = validatePageContent(
      build({
        layout: "comparison",
        sides: { a: { label: "左侧", points: ["1", "2"] }, b: { label: "右侧", points: ["1"] } },
      }),
    );
    assert.ok(
      problems.some((p) => p.includes("两侧条数不等")),
      problems.join("|"),
    );
  });

  test("art 与 customSvg 同时存在时报错（手改分镜的兜底）", () => {
    const page = build({ captions: ["甲"] });
    page.art = "flow";
    page.customSvg = [{ type: "circle", cx: 10, cy: 10, r: 5 }];
    const problems = validatePageContent(page);
    assert.ok(
      problems.some((p) => p.includes("同时给出了 art")),
      problems.join("|"),
    );
  });

  test("要点 anchor 超出字幕范围时报错", () => {
    const problems = validatePageContent(build({ captions: ["甲", "乙"], points: [{ text: "要点", anchor: 5 }] }));
    assert.ok(
      problems.some((p) => p.includes("anchor 越界")),
      problems.join("|"),
    );
  });

  test("要点 anchor 顺序倒错时报错", () => {
    const problems = validatePageContent(
      build({
        captions: ["甲", "乙", "丙"],
        points: [
          { text: "要点一", anchor: 2 },
          { text: "要点二", anchor: 0 },
        ],
      }),
    );
    assert.ok(
      problems.some((p) => p.includes("anchor 顺序错乱")),
      problems.join("|"),
    );
  });

  test("三个要点共用同一图标时报错", () => {
    const problems = validatePageContent(
      build({
        points: [
          { text: "a", icon: "rocket" },
          { text: "b", icon: "rocket" },
          { text: "c", icon: "rocket" },
        ],
      }),
    );
    assert.ok(
      problems.some((p) => p.includes("全部使用图标")),
      problems.join("|"),
    );
  });
});

describe("collectStoryboardWarnings：分镜与大纲的偏差汇总", () => {
  test("无问题时返回 null", () => {
    assert.equal(
      collectStoryboardWarnings({ pages: [{ pageIndex: 0, title: "p", points: ["a"], layout: "title" }] }, null),
      null,
    );
  });

  test("要点超过 6 条时提示层级过密", () => {
    const warn = collectStoryboardWarnings({
      pages: [{ pageIndex: 1, title: "p", points: Array.from({ length: 7 }, (_, i) => `p${i}`), layout: "points" }],
    });
    assert.ok(warn && warn.includes("要点过多"), String(warn));
  });

  test("实际版式与大纲不符时提示偏差", () => {
    const warn = collectStoryboardWarnings(
      { pages: [{ pageIndex: 0, title: "p", points: [], layout: "points" }] },
      { pages: [{ layout: "chart" }] },
    );
    assert.ok(warn && warn.includes("版式偏差"), String(warn));
  });

  test("大纲规划了图表却没生成时提示未兑现", () => {
    const warn = collectStoryboardWarnings(
      { pages: [{ pageIndex: 0, title: "p", points: [], layout: "chart", chart: null }] },
      { pages: [{ layout: "chart" }] },
    );
    assert.ok(warn && warn.includes("未兑现"), String(warn));
  });
});
