import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { fallbackPrompt, pagePrompt, planPrompt, regeneratePrompt, stripPrompt, tone } from "./prompts.js";
import type { VideoParams } from "../types.js";

/**
 * prompt 是纯字符串拼装：输入参数 → 输出文本。
 * 这里断言的是「关键约束有没有被拼进去」，防止后续改模板时把某条硬性规则删掉。
 */

const params = (over: Partial<VideoParams> = {}): VideoParams => ({
  width: 1920,
  height: 1080,
  fps: 30,
  tone: "casual",
  narration: true,
  subtitles: true,
  bgm: "default",
  granularity: "medium",
  theme: "tech",
  ...over,
});

describe("stripPrompt", () => {
  test("去掉首尾空白", () => {
    assert.equal(stripPrompt("  文案  "), "文案");
  });

  test("超长文案截断到 8000 字", () => {
    assert.equal(stripPrompt("字".repeat(9000)).length, 8000);
  });
});

describe("tone", () => {
  test("三档语气映射", () => {
    assert.equal(tone(params({ tone: "formal" })), "正式严谨");
    assert.equal(tone(params({ tone: "energetic" })), "活泼有感染力");
  });

  test("未知语气回落到 casual", () => {
    assert.equal(tone(params({ tone: "unknown" as never })), "轻松易懂");
  });
});

describe("planPrompt（Pass 1 大纲）", () => {
  test("把沟通目标三段拼进 prompt", () => {
    const p = planPrompt(params({ audience: "初中生", coreMessage: "热量守恒", audienceOutcome: "会算卡路里" }));
    assert.ok(p.includes("目标受众：初中生。"));
    assert.ok(p.includes("核心信息：热量守恒。"));
    assert.ok(p.includes("观众收获：会算卡路里。"));
  });

  test("未填沟通目标时不出现空标签", () => {
    const p = planPrompt(params());
    assert.ok(!p.includes("目标受众："));
  });

  test("拆稿粒度决定页数区间", () => {
    assert.ok(planPrompt(params({ granularity: "fine" })).includes("6~10 页"));
    assert.ok(planPrompt(params({ granularity: "coarse" })).includes("2~4 页"));
  });

  test("目标时长会折算成页数上限", () => {
    const p = planPrompt(params({ targetDurationSec: 60 }));
    assert.ok(p.includes("目标成片时长约 60 秒"));
    assert.ok(p.includes("本片 pages 最多 6 个"));
  });

  test("枚举约束与校验口径写在 prompt 里", () => {
    const p = planPrompt(params());
    assert.ok(p.includes("chart(pyramid)"));
    assert.ok(p.includes("只能取这 14 个值之一"));
    assert.ok(p.includes("只能取这 5 个值之一或 null"));
    // 生成式版式必须在大纲阶段就被约束住，否则模型会滥用 code 页
    assert.ok(p.includes('"code"'));
    assert.ok(p.includes("全片最多 2 页"));
  });

  test("无参数调用不抛错", () => {
    assert.ok(planPrompt().length > 0);
  });
});

describe("pagePrompt（Pass 2 逐页展开）", () => {
  test("拼入用户文案、大纲与上一页内容", () => {
    const p = pagePrompt(
      1,
      "用户文案ABC",
      "【本页】大纲XYZ",
      "上一页旁白",
      "",
      { layout: "points" },
      params(),
      undefined,
      3,
    );
    assert.ok(p.includes("用户文案ABC"));
    assert.ok(p.includes("大纲XYZ"));
    assert.ok(p.includes("上一页旁白"));
    assert.ok(p.includes("这是全片第 2 页 / 共 3 页"));
  });

  test("位置提示按序号切换（开头 / 中段 / 结尾）", () => {
    assert.ok(
      pagePrompt(0, "u", "o", "p", "", undefined, params(), undefined, 3).includes("这是全片第 1 页（共 3 页）"),
    );
    assert.ok(
      pagePrompt(2, "u", "o", "p", "", undefined, params(), undefined, 3).includes("这是全片最后一页（第 3 页）"),
    );
  });

  test("第一个讲解页注入「场景代入开场」硬性要求", () => {
    const p = pagePrompt(1, "u", "o", "p", "", { layout: "points" }, params(), undefined, 5);
    assert.ok(p.includes("场景代入开场"));
  });

  test("retryHint 被透传进校验修正上下文", () => {
    const p = pagePrompt(0, "u", "o", "p", "", undefined, params(), "上一轮字幕重复", 3);
    assert.ok(p.includes("上一轮字幕重复"));
  });

  test("目标时长换算成本页字幕条数上限", () => {
    const p = pagePrompt(1, "u", "o", "p", "", { layout: "points" }, params({ targetDurationSec: 120 }), undefined, 4);
    assert.ok(p.includes("本页 captions 最多"));
  });

  test("图表页给出 chart 字段规则", () => {
    const p = pagePrompt(1, "u", "o", "p", "", { layout: "chart", chart: true }, params(), undefined, 3);
    assert.ok(p.includes("type 从 8 种选"));
  });
});

describe("fallbackPrompt（兜底直出）", () => {
  test("包含页数区间与语气", () => {
    const p = fallbackPrompt(params({ tone: "formal" }));
    assert.ok(p.includes("2~6 个"));
    assert.ok(p.includes("正式严谨"));
  });
});

describe("regeneratePrompt（单页重做）", () => {
  test("指明目标页并锁定版式/图标", () => {
    const p = regeneratePrompt(
      1,
      "用户文案",
      "上一页",
      "后续页",
      "flow",
      "原标题",
      params(),
      undefined,
      "points",
      "build",
      "rocket",
    );
    assert.ok(p.includes("重新生成第 2 页"));
    assert.ok(p.includes("原第 2 页标题：原标题"));
    assert.ok(p.includes("只返回【恰好一个】JSON 对象"));
  });
});

describe("code 版式的竖屏契约", () => {
  /**
   * 生成代码只能看到 prompt：契约里不写清楚"同一页还会被渲染成竖屏"，
   * AI 就会按 1920×1080 写死横向排布 —— 实测三张 minWidth:340 的统计卡
   * 在竖屏 952 可用宽度下溢出，左右两张被裁。这几条断言防的是"改模板时把规则删掉"。
   */
  const codePrompt = () =>
    pagePrompt(2, "一段文案", "大纲", "", "", { layout: "code" } as never, params(), undefined, 6);

  test("告诉模型 props 里有 portrait / width / height", () => {
    const p = codePrompt();
    assert.match(p, /portrait/);
    assert.match(p, /\bwidth\b/);
    assert.match(p, /\bheight\b/);
  });

  test("说明竖屏画布尺寸与内容带", () => {
    const p = codePrompt();
    assert.match(p, /1080×1920/);
    assert.match(p, /952/);
  });

  test("要求别写死横向宽度，给出 flexWrap 这类自适应手段", () => {
    const p = codePrompt();
    assert.match(p, /flexWrap/);
  });
});