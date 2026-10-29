import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pagePrompt } from "./prompts.js";

/**
 * 入场时机守卫。
 *
 * 起因（真成片抽帧量化）：元素入场一律绑字幕序号 —— 第 i 个元素等第 i 句字幕开讲。
 * 一句字幕常占掉半页，于是 9 秒的环形页第三个节点到**页内 58%** 才出现，页内 30% 时
 * 只有 1/3 个节点、旁边一片空白；折叠流程页三张卡同理只有 2/3。观众读到的是"内容
 * 缺失/渲染坏了"，而不是"还没长出来"。而预览图取的是页内 75%，所以从 UI 上根本看不
 * 出来。
 *
 * 修法分两头，两头都必须钉住，少一头就会退回去：
 * 1. 渲染端：只有显式 `anchor` 才跟字幕对齐，其余走页首节奏 + `REVEAL_DEADLINE` 封顶；
 * 2. 提示词端：`anchor` 从"默认逐条锚定"改成"默认不写"，否则模型会把旧行为写回来
 *    （实测旧提示词下 4 页 13 个要点有 10 个带 anchor）。
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const renderSrc = path.join(here, "..", "..", "render", "src");
const read = (rel: string) => readFileSync(path.join(renderSrc, rel), "utf-8");

describe("入场时机：页面必须在页内 45% 前长齐", () => {
  test("REVEAL_DEADLINE 存在且落在 (0, 0.5]", () => {
    const src = read(path.join("shared", "render", "captionTiming.tsx"));
    const m = src.match(/export const REVEAL_DEADLINE\s*=\s*([0-9.]+)\s*;/);
    assert.ok(m, "缺少 REVEAL_DEADLINE 常量");
    const v = Number(m[1]);
    assert.ok(v > 0 && v <= 0.5, `REVEAL_DEADLINE=${v}：超过 0.5 就等于没封顶`);
  });

  test("resolveAnchor 不再拿字幕序号当默认入场帧", () => {
    const src = read(path.join("shared", "render", "captionTiming.tsx"));
    assert.equal(
      /return timing\.captions\[fi\]\.startFrame/.test(src),
      false,
      "无 anchor 的元素又回到「第 fi 个字幕开讲时才出现」了 —— 页面会在前半程缺内容",
    );
    assert.match(
      src,
      /if \(anchor !== undefined && anchor < n\) return timing\.captions\[anchor\]\.startFrame;/,
      "显式 anchor 必须仍然精确对齐字幕（这是 anchor 唯一的用途）",
    );
  });

  test("PageBody 的 frameAt 用页首节奏 + 封顶，不再查字幕表", () => {
    const src = read(path.join("scenes", "PageBody.tsx"));
    assert.match(src, /import \{[^}]*REVEAL_DEADLINE/s, "PageBody 没引入 REVEAL_DEADLINE");
    assert.match(
      src,
      /Math\.min\(start, Math\.round\(pageFrames \* REVEAL_DEADLINE\)\)/,
      "frameAt 必须把页首节奏封顶到 REVEAL_DEADLINE",
    );
    assert.match(src, /buildFrameAt\(stagger, pageFrames\)/, "buildFrameAt 必须拿到 pageFrames");
    assert.equal(
      /buildFrameAt\(captions/.test(src),
      false,
      "buildFrameAt 又去查字幕表了：元素会重新跟着字幕一句一句出现",
    );
  });

  test("提示词把 anchor 说成例外，而不是默认逐条锚定", () => {
    const p = pagePrompt(
      1,
      "u",
      "o",
      "p",
      "",
      { layout: "points" },
      {
        width: 1920,
        height: 1080,
        fps: 30,
        tone: "casual",
        narration: true,
        subtitles: true,
        bgm: "default",
        granularity: "medium",
        theme: "tech",
      },
    );
    assert.equal(p.includes("默认锚定到第 k 条字幕"), false);
    assert.ok(p.includes("绝大多数要点不要写 anchor"));
  });
});
