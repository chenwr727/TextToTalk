import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RENDER_PROGRESS_BASE,
  RENDER_PROGRESS_CAP,
  RENDER_PROGRESS_SPAN,
  createRenderLogger,
  parseRenderProgress,
} from "./renderProgress.js";

const progressAt = (done: number, total: number): number =>
  Math.min(RENDER_PROGRESS_CAP, RENDER_PROGRESS_BASE + (done / total) * RENDER_PROGRESS_SPAN);

describe("parseRenderProgress：从 Remotion 输出里抽进度", () => {
  test("解析 Rendered 行", () => {
    assert.equal(parseRenderProgress("Rendered 100/300"), progressAt(100, 300));
  });

  test("解析 Encoded / Stitching / stills 变体", () => {
    assert.equal(parseRenderProgress("Encoded 600/600"), progressAt(600, 600));
    assert.equal(parseRenderProgress("Stitching 3/10"), progressAt(3, 10));
    assert.equal(parseRenderProgress("Rendered stills 3/10"), progressAt(3, 10));
  });

  test("同一段里多行进度只取最后一个", () => {
    const chunk = "Rendered 1/10\nRendered 5/10\nRendered 9/10\n";
    assert.equal(parseRenderProgress(chunk), progressAt(9, 10));
  });

  test("完成数超过总数时封顶在 98%", () => {
    assert.equal(parseRenderProgress("Rendered 400/300"), RENDER_PROGRESS_CAP);
  });

  test("没有进度信息返回 null", () => {
    assert.equal(parseRenderProgress("Bundling..."), null);
    assert.equal(parseRenderProgress(""), null);
  });

  test("总数为 0 的行被忽略", () => {
    assert.equal(parseRenderProgress("Rendered 0/0"), null);
  });

  test("千分位/额外噪声文字不影响解析", () => {
    assert.equal(parseRenderProgress("[out] 🎞 Rendered frames 42/84 in 3.2s"), progressAt(42, 84));
  });
});

describe("createRenderLogger：环形缓冲与落盘", () => {
  test("超出行数上限时丢弃最旧的行，tail 返回最新的若干行", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ttt-renderlog-"));
    const logFile = path.join(dir, "render.log");
    try {
      const logger = createRenderLogger({ logFile, maxLines: 3 });
      for (const n of [1, 2, 3, 4, 5]) logger.append("out", `第 ${n} 行`);
      assert.equal(logger.tail(2), "[out] 第 4 行\n[out] 第 5 行");
      assert.equal(logger.tail(10), "[out] 第 3 行\n[out] 第 4 行\n[out] 第 5 行");
      // 落盘保留完整历史（不受环形缓冲上限限制）
      const saved = readFileSync(logFile, "utf8").trim().split(/\r?\n/);
      assert.equal(saved.length, 5);
      assert.equal(saved[0], "[out] 第 1 行");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stdout 逐行记日志，进度每个 chunk 只回调一次（取该 chunk 内最后一条）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ttt-renderlog-"));
    const logFile = path.join(dir, "render.log");
    try {
      const seen: number[] = [];
      const logger = createRenderLogger({ logFile, onProgress: (p) => seen.push(p) });
      logger.stdout(Buffer.from("Rendered 10/20\nRendered 20/20\n"));
      assert.deepEqual(seen, [progressAt(20, 20)]);
      assert.match(logger.tail(2), /Rendered 10\/20/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stderr 只记录非空行并回调", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ttt-renderlog-"));
    const logFile = path.join(dir, "render.log");
    try {
      const lines: string[] = [];
      const logger = createRenderLogger({ logFile, onStderrLine: (l) => lines.push(l) });
      logger.stderr(Buffer.from("警告 A\n\n警告 B\n"));
      assert.deepEqual(lines, ["警告 A", "警告 B"]);
      assert.equal(logger.tail(5), "[err] 警告 A\n[err] 警告 B");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("没有 onProgress 时不解析也不回调", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ttt-renderlog-"));
    const logFile = path.join(dir, "render.log");
    try {
      const logger = createRenderLogger({ logFile });
      assert.doesNotThrow(() => logger.stdout("Rendered 1/2"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
