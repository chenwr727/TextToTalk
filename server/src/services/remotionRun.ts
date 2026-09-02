import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { renderDir } from "./runtime.js";

const RUNNER = path.join(renderDir, "run-render.mjs");

export function runnerCommand(args: string[]): { cmd: string; extraEnv: NodeJS.ProcessEnv } {
  const inElectronNode = process.env.ELECTRON_RUN_AS_NODE === "1" || Boolean(process.versions?.electron);
  const node = inElectronNode ? process.execPath : "node";
  const cmd = [node, RUNNER, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
  return { cmd, extraEnv: inElectronNode ? { ELECTRON_RUN_AS_NODE: "1" } : {} };
}

export function spawnRunner(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): ChildProcess {
  const { cmd, extraEnv } = runnerCommand(args);
  return spawn(cmd, {
    cwd: opts.cwd ?? renderDir,
    env: { ...process.env, ...opts.env, ...extraEnv },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
