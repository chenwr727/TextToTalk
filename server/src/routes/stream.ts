import type { FastifyInstance } from "fastify";
import { setupSseStream, subscribe } from "../services/sseHub.js";
import { authorizeTask } from "../services/auth.js";

export function registerStreamRoutes(app: FastifyInstance) {
  app.get("/api/stream", async (req, reply) => {
    const taskId = String((req.query as { id?: string }).id ?? "");
    if (!taskId) return reply.code(400).send({ error: "missing id" });
    const task = authorizeTask(req, reply, taskId);
    if (!task) return reply;
    if (task && task.status === "REVIEWING" && task.storyboard) {
      const { push, close } = setupSseStream(reply);
      push("done", task.storyboard);
      close();
      return reply;
    }
    const { close } = setupSseStream(reply);
    const unsubscribe = subscribe(taskId, (frame) => {
      if (reply.raw.writableEnded) {
        unsubscribe();
        return;
      }
      reply.raw.write(frame);
    });
    reply.raw.on("close", () => {
      unsubscribe();
      close();
    });
    return reply;
  });
}