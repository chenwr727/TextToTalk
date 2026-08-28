import { env } from "./env.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlmError extends Error {
  constructor(msg: string, public status?: number) { super(msg); }
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  enableThinking?: boolean;
}

export async function chatStream(opts: ChatStreamOptions): Promise<string> {
  const key = env("LLM_API_KEY");
  if (!key) throw new LlmError("缺少 LLM_API_KEY（请配置 server/.env）");

  const endpoint = env("LLM_API_URL").replace(/\/$/, "");
  const model = env("LLM_MODEL") || "deepseek-v4-flash";
  const enableThinking =
    opts.enableThinking ?? env("LLM_ENABLE_THINKING") === "true";

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
      ...(enableThinking
        ? { thinking: { type: "enabled" } }
        : { thinking: { type: "disabled" } }),
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
      } catch { /* 忽略非 JSON 帧 */ }
    }
  }
  return full;
}