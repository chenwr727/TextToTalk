import { writeFileSync } from "node:fs";
import type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsSynthOptions } from "./types.js";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_WORKSPACE_ID = process.env.DASHSCOPE_WORKSPACE_ID;
const DASHSCOPE_REGION = process.env.DASHSCOPE_REGION || "cn-beijing";

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
      throw new Error(`DashScope TTS HTTP ${resp.status}: ${body.slice(0, 300)}`);
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