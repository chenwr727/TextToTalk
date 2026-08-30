import type { FastifyInstance } from "fastify";
import { assetsDir, outDir, publicBaseUrl } from "../services/runtime.js";
import { env } from "../services/env.js";
import { checkRenderDeps } from "../services/deps.js";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({
    ok: true,
    outDir,
    assetsDir,
    publicBaseUrl,
    deps: await checkRenderDeps(),
    llm: {
      baseUrl: env("LLM_API_URL"),
      model: env("LLM_MODEL"),
      configured: Boolean(env("LLM_API_KEY")),
    },
  }));
}
