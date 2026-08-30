import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webDir } from "../services/runtime.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".map": "application/json; charset=utf-8",
};

function resolveWebDir(): string | null {
  const candidates = [
    webDir,
    path.resolve(here, "..", "..", "..", "web", "dist"),
    path.resolve(here, "..", "..", "web-dist"),
  ].filter(Boolean) as string[];
  return candidates.find((d) => existsSync(path.join(d, "index.html"))) ?? null;
}

export function registerStaticRoutes(app: FastifyInstance) {
  const dir = resolveWebDir();
  if (!dir) return dir;
  const root = path.normalize(dir);

  app.get("/*", async (req, reply) => {
    const raw = String((req.params as Record<string, string>)["*"] ?? "");
    let rel: string;
    try {
      rel = decodeURIComponent(raw);
    } catch {
      return reply.code(400).send({ error: "bad path" });
    }
    if (rel === "api" || rel.startsWith("api/")) {
      return reply.code(404).send({ error: "not found" });
    }
    const full = path.normalize(path.join(root, rel.replace(/^\/+/, "")));
    if (full !== root && !full.startsWith(root + path.sep)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const target =
      full.startsWith(root + path.sep) && existsSync(full) && statSync(full).isFile()
        ? full
        : path.join(root, "index.html");
    reply.type(MIME[path.extname(target).toLowerCase()] || "application/octet-stream");
    if (target.endsWith("index.html")) reply.header("Cache-Control", "no-cache");
    return reply.send(createReadStream(target));
  });

  return dir;
}
