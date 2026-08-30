import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { renderDir } from "./runtime.js";

const REMOTION_CLI = path.join(renderDir, "node_modules", "@remotion", "cli", "remotion-cli.js");

export function remotionCommand(args: string[]): { cmd: string; extraEnv: NodeJS.ProcessEnv } {
  const inElectronNode = process.env.ELECTRON_RUN_AS_NODE === "1" || Boolean(process.versions?.electron);
  if (inElectronNode) {
    const node = process.execPath;
    const cmd = [node, REMOTION_CLI, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
    return { cmd, extraEnv: { ELECTRON_RUN_AS_NODE: "1" } };
  }
  const cmd = ["node", REMOTION_CLI, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
  return { cmd, extraEnv: {} };
}

export function spawnRemotion(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv },
): ChildProcess {
  const { cmd, extraEnv } = remotionCommand(args);
  return spawn(cmd, {
    cwd: opts.cwd ?? renderDir,
    env: { ...process.env, ...opts.env, ...extraEnv },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
