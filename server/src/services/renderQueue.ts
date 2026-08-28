import { patchTask } from "./taskStore.js";

const MAX_CONCURRENT = Number(process.env.RENDER_MAX_TASKS || 1);

let active = 0;
const queue: { taskId: string; run: () => Promise<void> }[] = [];

export function enqueueRender(taskId: string, run: () => Promise<void>): void {
  queue.push({ taskId, run });
  pump();
}

function pump(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    active++;
    patchTask(next.taskId, { status: "RENDERING", progress: 0 });
    next
      .run()
      .catch((e) => {
        console.error("[render] 队列任务异常", e);
        patchTask(next.taskId, { status: "FAILED", error: String(e) });
      })
      .finally(() => {
        active--;
        pump();
      });
  }
}

export function renderQueueStats() {
  return { active, queued: queue.length, max: MAX_CONCURRENT };
}