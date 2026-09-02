import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { serverRoot } from "../env.js";
import type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsEngineRegistry, TtsConfigFile, TtsEnvField } from "./types.js";
import { edgeFactory } from "./edge.js";
import { dashScopeFactory } from "./dashscope.js";
import { seedTtsFactory } from "./seedtts.js";

export type { TtsEngine, TtsEngineConfig, TtsEngineFactory, TtsEngineRegistry, TtsVoiceOption, TtsConfigFile, TtsSynthOptions, TtsEnvField } from "./types.js";

const factories: Record<string, TtsEngineFactory> = {
  edge: edgeFactory,
  dashscope: dashScopeFactory,
  seedtts: seedTtsFactory,
};

function configPath(): string {
  return process.env.TTT_TTS_CONFIG || path.join(serverRoot, "tts.config.json");
}

function loadConfigFile(): TtsConfigFile {
  const file = configPath();
  if (!existsSync(file)) {
    console.warn(`[tts] 未找到配置文件 ${file}，将无可用引擎`);
    return { engines: [] };
  }
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as TtsConfigFile;
  } catch (e) {
    console.error(`[tts] 配置文件解析失败 ${file}:`, e);
    return { engines: [] };
  }
}

function missingEnv(cfg: TtsEngineConfig): string[] {
  const required = cfg.requiresEnv ?? [];
  return required
    .filter((f) => f.required !== false)
    .map((f) => f.name)
    .filter((name) => !process.env[name]);
}

function buildEngine(cfg: TtsEngineConfig): TtsEngine | null {
  const type = cfg.type ?? cfg.id;
  const factory = factories[type];
  if (!factory) {
    console.warn(`[tts] 未知引擎类型 "${type}"（id=${cfg.id}），已跳过`);
    return null;
  }
  const missing = missingEnv(cfg);
  if (missing.length > 0) {
    console.warn(`[tts] 引擎 "${cfg.id}"（${cfg.name}）缺少环境变量 ${missing.join(", ")}，已跳过（请配置后重启）`);
    return null;
  }
  return factory(cfg);
}

export function loadEngines(): TtsEngineRegistry {
  const config = loadConfigFile();
  const registry: TtsEngineRegistry = {};
  for (const cfg of config.engines ?? []) {
    if (cfg.enabled === false) continue;
    const engine = buildEngine(cfg);
    if (engine) registry[engine.id] = engine;
  }
  return registry;
}

export const ttsEngines: TtsEngineRegistry = loadEngines();

export const DEFAULT_TTS_ENGINE: string =
  (() => {
    const cfg = loadConfigFile();
    if (cfg.defaultEngine && ttsEngines[cfg.defaultEngine]) return cfg.defaultEngine;
    return Object.keys(ttsEngines)[0] ?? "";
  })();

export function resolveEngine(id?: string): TtsEngine | undefined {
  if (id && ttsEngines[id]) return ttsEngines[id];
  return ttsEngines[DEFAULT_TTS_ENGINE];
}

export function listEngines(): { id: string; name: string; voices: { id: string; label: string }[] }[] {
  return Object.values(ttsEngines).map((e) => ({
    id: e.id,
    name: e.name,
    voices: e.voices,
  }));
}

export function listEnvFields(): TtsEnvField[] {
  const config = loadConfigFile();
  const seen = new Map<string, string>();
  const fields: TtsEnvField[] = [];
  for (const cfg of config.engines ?? []) {
    if (cfg.enabled === false) continue;
    for (const f of cfg.requiresEnv ?? []) {
      if (seen.has(f.name)) continue;
      seen.set(f.name, cfg.id);
      fields.push({ ...f, engine: cfg.id, engineName: cfg.name });
    }
  }
  return fields;
}