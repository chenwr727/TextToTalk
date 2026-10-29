import { writeFileSync } from "node:fs";
import type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsSynthOptions } from "./types.js";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_WORKSPACE_ID = process.env.DASHSCOPE_WORKSPACE_ID;
const DASHSCOPE_REGION = process.env.DASHSCOPE_REGION || "cn-beijing";

/**
 * 把百炼的错误码翻成人话。
 *
 * `qwen-audio-3.0-tts-flash` 在免费额度用完时返回 403 + `AllocationQuota.FreeTierOnly`，
 * 原始 body 里全是 request_id 和代码，界面上看不出是"额度没了"还是"密钥错了"——
 * 这两种情况的处理完全不同（一个去开通付费，一个去换 Key），必须区分开。
 */
function explain(body: string): string | null {
  if (body.includes("AllocationQuota.FreeTierOnly")) {
    return "该模型只能用免费额度，当前额度已用完（去百炼控制台开通付费额度，或换 cosyvoice 系列模型）";
  }
  if (body.includes("InvalidApiKey") || body.includes("Unauthorized")) {
    return "API Key 无效或无权限（检查 DASHSCOPE_API_KEY 是否与控制台一致）";
  }
  if (body.includes("ModelNotFound") || body.includes("Model.AccessDenied")) {
    return "当前账号无权访问该模型（换模型，或在控制台开通）";
  }
  return null;
}

function synthDashScope(config: TtsEngineConfig) {
  const model = (config.model as string) || "cosyvoice-v3-flash";
  const sampleRate = (config.sampleRate as number) || 24000;
  const format = (config.format as string) || "wav";

  return async function synth(text: string, outPath: string, voice: string, options?: TtsSynthOptions): Promise<void> {
    if (!DASHSCOPE_API_KEY) throw new Error("DashScope TTS: 缺少环境变量 DASHSCOPE_API_KEY");
    if (!DASHSCOPE_WORKSPACE_ID) throw new Error("DashScope TTS: 缺少环境变量 DASHSCOPE_WORKSPACE_ID");

    const endpoint = `https://${DASHSCOPE_WORKSPACE_ID}.${DASHSCOPE_REGION}.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`;

    const input: Record<string, unknown> = { text, voice, format, sample_rate: sampleRate };
    if (options?.speed != null && options.speed !== 1) input.speed = options.speed;
    if (options?.volume != null && options.volume !== 1) input.volume = Math.round(options.volume * 50);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`DashScope TTS HTTP ${resp.status}: ${explain(body) || body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as { output?: { audio?: { url?: string } } };
    const audioUrl = data.output?.audio?.url;
    if (!audioUrl) throw new Error("DashScope TTS: 响应中未包含音频 URL");

    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) throw new Error(`DashScope TTS 下载音频失败 HTTP ${audioResp.status}`);
    writeFileSync(outPath, Buffer.from(await audioResp.arrayBuffer()));
  };
}

export const dashScopeFactory: TtsEngineFactory = (config: TtsEngineConfig): TtsEngine => ({
  id: config.id,
  name: config.name,
  voices: config.voices ?? [],
  config,
  synthToFile: synthDashScope(config),
});
