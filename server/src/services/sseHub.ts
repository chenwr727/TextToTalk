import type { FastifyReply } from "fastify";

type PushFn = (data: string) => void;

const streams = new Map<string, Set<PushFn>>();

export function subscribe(taskId: string, push: PushFn): () => void {
  let set = streams.get(taskId);
  if (!set) {
    set = new Set();
    streams.set(taskId, set);
  }
  set.add(push);
  return () => {
    set.delete(push);
  };
}

export function publish(taskId: string, event: string, data: unknown): void {
  const set = streams.get(taskId);
  if (!set) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const push of set) {
    try {
      push(frame);
    } catch {}
  }
}

export function setupSseStream(
  reply: FastifyReply
): { push: (event: string, data: unknown) => void; close: () => void } {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  reply.raw.flushHeaders();

  const push = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const close = () => {
    if (!reply.raw.writableEnded) reply.raw.end();
  };
  return { push, close };
}