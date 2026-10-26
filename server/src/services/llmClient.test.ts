import { describe, test } from "node:test";
import assert from "node:assert/strict";

// env 在 import 时就读取，所以先补齐再动态导入
process.env.LLM_API_KEY = process.env.LLM_API_KEY || "test-key";
const { chatStream, LlmError } = await import("./llmClient.js");

/**
 * 端到端跑真实模型时撞到的问题：生成式版式的整页源码动辄上万字符，
 * 网关偶发 "other side closed" 直接断流，没有重试就会让整条生成白跑。
 * 这些用例把"哪些错该重发、哪些不该"钉住。
 */
const sseResponse = (text: string) => {
  const enc = new TextEncoder();
  const frames = [`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`, "data: [DONE]\n"];
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < frames.length ? { done: false, value: enc.encode(frames[i++]) } : { done: true, value: undefined },
      }),
    },
  };
};

const socketError = () => {
  const err = new TypeError("fetch failed") as TypeError & { cause?: { code?: string } };
  err.cause = { code: "UND_ERR_SOCKET" };
  return err;
};

const withFetch = async (impl: () => Promise<unknown>, fn: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl as unknown as typeof globalThis.fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
};

describe("chatStream 的网络抖动重试", () => {
  test("断流后重发成功：返回完整内容，并通知调用方重置", async () => {
    let calls = 0;
    const retries: number[] = [];
    await withFetch(
      async () => {
        calls += 1;
        if (calls === 1) throw socketError();
        return sseResponse("可用");
      },
      async () => {
        const out = await chatStream({
          messages: [{ role: "user", content: "hi" }],
          onRetry: (n) => retries.push(n),
        });
        assert.equal(out, "可用");
      },
    );
    assert.equal(calls, 2);
    assert.deepEqual(retries, [1]);
  });

  test("4xx 是确定性错误，不重发（白重发只会浪费额度）", async () => {
    let calls = 0;
    await withFetch(
      async () => {
        calls += 1;
        return { ok: false, status: 401, text: async () => "bad key", body: null };
      },
      async () => {
        await assert.rejects(
          () => chatStream({ messages: [{ role: "user", content: "hi" }] }),
          (e: unknown) => e instanceof LlmError && e.status === 401,
        );
      },
    );
    assert.equal(calls, 1, "401 不应重发");
  });

  test("5xx 属于瞬时故障，会重发", async () => {
    let calls = 0;
    await withFetch(
      async () => {
        calls += 1;
        return calls === 1 ? { ok: false, status: 503, text: async () => "busy", body: null } : sseResponse("ok");
      },
      async () => {
        assert.equal(await chatStream({ messages: [{ role: "user", content: "hi" }] }), "ok");
      },
    );
    assert.equal(calls, 2);
  });

  test("一直失败时有限次重试后抛出，不会无限重试", async () => {
    let calls = 0;
    await withFetch(
      async () => {
        calls += 1;
        throw socketError();
      },
      async () => {
        await assert.rejects(() => chatStream({ messages: [{ role: "user", content: "hi" }] }));
      },
    );
    assert.equal(calls, 3, "首次 + 2 次重试");
  });

  test("用户主动中止时不重发", async () => {
    const ac = new AbortController();
    let calls = 0;
    await withFetch(
      async () => {
        calls += 1;
        ac.abort();
        throw socketError();
      },
      async () => {
        await assert.rejects(() => chatStream({ messages: [{ role: "user", content: "hi" }], signal: ac.signal }));
      },
    );
    assert.equal(calls, 1, "中止后不应再发请求");
  });
});
