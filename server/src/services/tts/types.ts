export interface TtsVoiceOption {
  id: string;
  label: string;
}

export interface TtsEnvField {
  name: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  engine?: string;
  engineName?: string;
}

export interface TtsEngineConfig {
  id: string;
  name: string;
  enabled?: boolean;
  type?: string;
  model?: string;
  sampleRate?: number;
  format?: string;
  requiresEnv?: TtsEnvField[];
  voices: TtsVoiceOption[];
  [key: string]: unknown;
}

export interface TtsConfigFile {
  defaultEngine?: string;
  engines: TtsEngineConfig[];
}

export interface TtsSynthOptions {
  speed?: number;
  volume?: number;
}

export interface TtsEngine {
  id: string;
  name: string;
  voices: TtsVoiceOption[];
  config: TtsEngineConfig;
  synthToFile(text: string, outPath: string, voice: string, options?: TtsSynthOptions): Promise<void>;
}

export type TtsEngineRegistry = Record<string, TtsEngine>;

export type TtsEngineFactory = (config: TtsEngineConfig) => TtsEngine;