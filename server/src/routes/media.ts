import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { assetsDir } from "../services/runtime.js";

const MEDIA_ROOT = path.normalize(assetsDir);

export function registerMediaRoutes(app: FastifyInstance) {
  app.get("/api/media/*", async (req, reply) => {
    const rel = String((req.params as Record<string, string>)["*"] ?? "");
    if (!/^[A-Za-z0-9_\-/.]+\w+\.wav$/.test(rel)) return reply.code(400).send({ error: "illegal path" });
    const full = path.normalize(path.join(MEDIA_ROOT, rel));
    if (!full.toLowerCase().startsWith(MEDIA_ROOT.toLowerCase())) return reply.code(403).send({ error: "forbidden" });
    if (!existsSync(full)) return reply.code(404).send({ error: "not found" });
    return reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Accept-Ranges", "bytes")
      .type("audio/wav")
      .send(createReadStream(full));
  });
}