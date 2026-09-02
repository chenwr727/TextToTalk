import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { serverDir, webDistDir, binDir, runtimeDataDir, userDataDir } from "./paths";
import type { AppConfig } from "./config";
import { findChromium, findFfmpeg } from "./browser";

export interface Backend {
  port: number;
  baseUrl: string;
  proc: ChildProcess | null;
  stop: () => void;
}

let nodeShimDir: string | null = null;

function ensureNodeShim(): string {
  if (nodeShimDir && fs.existsSync(nodeShimDir)) return nodeShimDir;
  const dir = path.join(app.getPath("temp"), "ttt-node-shim");
  fs.mkdirSync(dir, { recursive: true });
  const electronBin = process.execPath;
  const bin = process.platform === "win32" ? path.join(dir, "node.cmd") : path.join(dir, "node");
  const script =
    process.platform === "win32"
      ? `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${electronBin}" %*\r\n`
      : `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\n"${electronBin}" "$@"\n`;
  fs.writeFileSync(bin, script, { mode: 0o755 });
  if (process.platform !== "win32") {
    try { fs.chmodSync(bin, 0o755); } catch {}
  }
  nodeShimDir = dir;
  return dir;
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function ensureUserTtsConfig(): string {
  const builtin = path.join(serverDir(), "tts.config.json");
  const userFile = path.join(userDataDir(), "tts.config.json");
  try {
    if (!fs.existsSync(userFile) && fs.existsSync(builtin)) {
      fs.mkdirSync(userDataDir(), { recursive: true });
      fs.copyFileSync(builtin, userFile);
      console.log(`[desktop] 已初始化用户 TTS 配置：${userFile}`);
    }
  } catch (e) {
    console.warn("[desktop] 初始化用户 TTS 配置失败，回退到内置配置：", e);
    return builtin;
  }
  return userFile;
}

function ttsEnvKeys(): string[] {
  try {
    const file = ensureUserTtsConfig();
    if (!fs.existsSync(file)) return [];
    const config = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      engines?: { enabled?: boolean; requiresEnv?: { name: string }[] }[];
    };
    const keys = new Set<string>();
    for (const eng of config.engines ?? []) {
      if (eng.enabled === false) continue;
      for (const f of eng.requiresEnv ?? []) if (f.name) keys.add(f.name);
    }
    return [...keys];
  } catch (e) {
    console.warn("[desktop] 读取 tts.config.json 失败：", e);
    return [];
  }
}

function buildEnv(port: number, cfg: AppConfig, packaged: boolean): NodeJS.ProcessEnv {
  const base = runtimeDataDir();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    TTT_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    TTT_OUT_DIR: path.join(base, "out"),
    TTT_ASSETS_DIR: path.join(base, "assets"),
  };

  if (packaged) env.TTT_ENV_FILE = path.join(userDataDir(), ".env");

  env.TTT_TTS_CONFIG = ensureUserTtsConfig();

  const web = webDistDir();
  if (fs.existsSync(path.join(web, "index.html"))) env.TTT_WEB_DIR = web;

  const keys = new Set([
    "LLM_API_KEY", "LLM_API_URL", "LLM_MODEL", "CHROME_PATH", "RENDER_CONCURRENCY",
    ...ttsEnvKeys(),
  ]);
  for (const key of keys) {
    const v = cfg[key];
    if (v && String(v).trim()) env[key] = String(v).trim();
  }

  const chrome = findChromium(cfg.CHROME_PATH);
  if (chrome) env.CHROME_PATH = chrome;
  env.TTT_CHROME_AVAILABLE = chrome ? "1" : "0";

  const extraBin = binDir();
  if (fs.existsSync(extraBin)) {
    env.TTT_BIN_DIR = extraBin;
    env.PATH = `${extraBin}${path.delimiter}${env.PATH ?? ""}`;
  }

  env.PATH = `${ensureNodeShim()}${path.delimiter}${env.PATH ?? ""}`;

  return env;
}

export async function startBackend(
  port: number,
  cfg: AppConfig,
  packaged: boolean,
  onLog: (line: string) => void,
): Promise<Backend> {
  const dir = serverDir();
  const tsxCli = path.join(dir, "node_modules", "tsx", "dist", "cli.mjs");
  const entry = path.join(dir, "src", "index.ts");

  if (!fs.existsSync(tsxCli)) throw new Error(`未找到 tsx：${tsxCli}\n请先在 server/ 目录安装依赖（pnpm install）。`);
  if (!fs.existsSync(entry)) throw new Error(`未找到后端入口：${entry}`);

  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, [tsxCli, entry], {
    cwd: dir,
    env: { ...buildEnv(port, cfg, packaged), ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let spawnError: Error | null = null;
  proc.on("error", (e) => {
    spawnError = e instanceof Error ? e : new Error(String(e));
  });

  const pipe = (stream: NodeJS.ReadableStream | null) => {
    stream?.on("data", (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) onLog(line);
    });
  };
  pipe(proc.stdout);
  pipe(proc.stderr);

  const backend: Backend = {
    port,
    baseUrl,
    proc,
    stop: () => {
      if (proc.exitCode === null && !proc.killed) proc.kill();
    },
  };

  await waitForHealth(baseUrl, 60_000, proc, () => spawnError);
  return backend;
}

export async function waitForHealth(
  baseUrl: string,
  timeoutMs: number,
  proc?: ChildProcess,
  getSpawnError?: () => Error | null,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError?.();
    if (spawnError) throw new Error(`后端启动失败：${spawnError.message}`);
    if (proc && proc.exitCode !== null) {
      throw new Error(`后端进程已退出（code ${proc.exitCode}），请查看日志。`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`后端在 ${timeoutMs}ms 内未就绪${lastErr ? `：${String(lastErr)}` : ""}`);
}

export function probeDeps(cfg: AppConfig) {
  const extraBin = fs.existsSync(binDir()) ? binDir() : undefined;
  return {
    chrome: findChromium(cfg.CHROME_PATH) ?? null,
    ffmpeg: findFfmpeg("ffmpeg", extraBin) ?? null,
  };
}
