import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { assetsDir, outDir } from "./runtime.js";

const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function removeTaskArtifacts(taskId: string): void {
  const targets = [
    path.join(outDir, `${taskId}.mp4`),
    path.join(outDir, `${taskId}.render.log`),
    path.join(outDir, `${taskId}.render.json`),
    path.join(outDir, `${taskId}.still.json`),
    path.join(outDir, taskId),
    path.join(assetsDir, "tts", taskId),
    path.join(assetsDir, "bgm", `${taskId}.wav`),
  ];
  for (const t of targets) {
    try {
      if (existsSync(t)) rmSync(t, { recursive: true, force: true });
    } catch {}
  }
}

function mtimeMs(p: string): number {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return Date.now();
  }
}

function collectOrphanTaskIds(keep: Set<string>): string[] {
  const found = new Set<string>();
  const dirs = [outDir, path.join(assetsDir, "tts"), path.join(assetsDir, "bgm")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const m = /^(task_[a-z0-9]+)/.exec(name);
      if (!m) continue;
      const id = m[1];
      if (keep.has(id)) continue;
      if (Date.now() - mtimeMs(path.join(dir, name)) < ORPHAN_MAX_AGE_MS) continue;
      found.add(id);
    }
  }
  return [...found];
}

export function cleanupOrphanArtifacts(keep: Set<string>): void {
  const orphans = collectOrphanTaskIds(keep);
  for (const id of orphans) removeTaskArtifacts(id);
  if (orphans.length) {
    console.log(`[cleanup] 已清理 ${orphans.length} 个孤儿任务的磁盘产物`);
  }
}
