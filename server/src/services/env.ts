import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.join(__dirname, "..", "..");

const DEFAULTS: Record<string, string> = {
  LLM_API_KEY: "",
  LLM_MODEL: "",
  LLM_API_URL: "https://api.deepseek.com/v1/chat/completions",
  LLM_ENABLE_THINKING: "false",
};

const values: Record<string, string> = { ...DEFAULTS };

function load() {
  for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    if (process.env[k]) values[k] = process.env[k]!;
  }
  const file = path.join(serverRoot, ".env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#") && !process.env[m[1]]) {
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        values[m[1]] = val;
        process.env[m[1]] = val;
      }
    }
  }
}

load();

export function env(k: keyof typeof DEFAULTS): string {
  return values[k] ?? "";
}