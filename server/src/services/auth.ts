import type { FastifyRequest, FastifyReply } from "fastify";
import { getTask } from "./taskStore.js";

function extractToken(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const q = (req.query as Record<string, string> | undefined) ?? {};
  return (q.token ?? "").trim();
}

export function authorizeTask(req: FastifyRequest, reply: FastifyReply, taskId: string) {
  const task = getTask(taskId);
  const token = extractToken(req);
  if (!task || !token || token !== task.token) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return task;
}