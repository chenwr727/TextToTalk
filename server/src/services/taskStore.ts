import type { Task } from "../types";

const tasks = new Map<string, Task>();

const TASK_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function id(): string {
  return "task_" + Math.random().toString(36).slice(2, 10);
}

function token(): string {
  return "tk_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function cleanup(): void {
  const now = Date.now();
  let removed = 0;
  for (const [taskId, t] of tasks) {
    if (now - t.createdAt > TASK_TTL_MS) {
      tasks.delete(taskId);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[taskStore] 已清理 ${removed} 个过期任务，剩余 ${tasks.size} 个`);
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS);

export function createTask(data: Omit<Task, "taskId" | "token" | "createdAt" | "updatedAt">): Task {
  const t: Task = {
    ...data,
    taskId: id(),
    token: token(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(t.taskId, t);
  return t;
}

export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

export function patchTask(taskId: string, patch: Partial<Task>): Task | undefined {
  const t = tasks.get(taskId);
  if (!t) return undefined;
  Object.assign(t, patch, { updatedAt: Date.now() });
  return t;
}