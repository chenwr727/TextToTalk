import fs from "node:fs";
import path from "node:path";
import { userDataDir } from "./paths";

export interface AppConfig {
  LLM_API_KEY?: string;
  LLM_API_URL?: string;
  LLM_MODEL?: string;
  CHROME_PATH?: string;
  RENDER_CONCURRENCY?: string;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_WORKSPACE_ID?: string;
  [key: string]: string | undefined;
}

const DEFAULTS: AppConfig = {
  LLM_API_KEY: "",
  LLM_API_URL: "https://api.deepseek.com/v1/chat/completions",
  LLM_MODEL: "deepseek-v4-flash",
  CHROME_PATH: "",
  RENDER_CONCURRENCY: "",
  DASHSCOPE_API_KEY: "",
  DASHSCOPE_WORKSPACE_ID: "",
};

function configFile(): string {
  return path.join(userDataDir(), "config.json");
}

export function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(configFile(), "utf-8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as AppConfig) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(next: AppConfig): AppConfig {
  const merged: AppConfig = { ...loadConfig(), ...next };
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
