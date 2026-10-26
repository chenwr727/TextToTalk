import { env } from "./env.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlmError extends Error {
  constructor(
    msg: string,
    public status?: number,
  ) {
    super(msg);
  }
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
  /** 网络抖了、正在整体重发这一次请求（调用方应清掉已收到的半截文本） */
  onRetry?: (attempt: number, reason: string) => void;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  enableThinking?: boolean;
}

/**
 * 网络抖动的整体重试次数。
 *
 * 为什么必须有：长输出（尤其生成式版式的整页源码）动辄上万字符，网关偶发
 * "other side closed" 直接断流。没有重试时，一次网络抖动就会让整条生成失败，
 * 用户白等一分钟。这类错误是**瞬时**的，重发即可。
 */
const NET_RETRY = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isTransient = (e: unknown): boolean => {
  if (e instanceof LlmError) return e.status === 429 || (typeof e.status === "number" && e.status >= 500);
  const err = e as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  const code = err?.cause?.code ?? err?.code;
  if (
    code &&
    ["UND_ERR_SOCKET", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"].includes(code)
  )
    return true;
  return /fetch failed|other side closed|terminated|socket hang up/i.test(err?.message ?? "");
};

async function chatStreamOnce(opts: ChatStreamOptions): Promise<string> {
  const key = env("LLM_API_KEY");
  if (!key) throw new LlmError("缺少 LLM_API_KEY（请配置 server/.env）");

  const endpoint = env("LLM_API_URL").replace(/\/$/, "");
  const model = env("LLM_MODEL") || "deepseek-v4-flash";
  const enableThinking = opts.enableThinking ?? env("LLM_ENABLE_THINKING") === "true";

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: opts.signal,
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(enableThinking ? { thinking: { type: "enabled" } } : { thinking: { type: "disabled" } }),
    }),
  });

  if (!resp.ok || !resp.body) {
    const body = await resp.text().catch(() => "");
    throw new LlmError(`LLM 请求失败(${resp.status}): ${body.slice(0, 300)}`, resp.status);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") break;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          full += delta;
          opts.onDelta?.(delta);
        }
      } catch {
        /* 忽略非 JSON 帧 */
      }
    }
  }
  return full;
}
export async function chatStream(opts: ChatStreamOptions): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= NET_RETRY; attempt++) {
    try {
      return await chatStreamOnce(opts);
    } catch (e) {
      lastErr = e;
      const aborted = opts.signal?.aborted;
      if (aborted || !isTransient(e) || attempt === NET_RETRY) throw e;
      const reason = (e as Error)?.message ?? String(e);
      opts.onRetry?.(attempt + 1, reason);
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr;
}
