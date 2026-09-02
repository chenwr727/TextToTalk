import type { FastifyInstance } from "fastify";
import { listEngines, listEnvFields, DEFAULT_TTS_ENGINE } from "../services/tts/index.js";

export function registerTtsRoutes(app: FastifyInstance) {
  app.get("/api/tts/engines", async () => ({
    defaultEngine: DEFAULT_TTS_ENGINE,
    engines: listEngines(),
  }));

  app.get("/api/tts/config-fields", async () => ({
    fields: listEnvFields(),
  }));
}