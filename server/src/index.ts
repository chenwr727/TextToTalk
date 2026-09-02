import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./routes/health.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerStreamRoutes } from "./routes/stream.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerTtsRoutes } from "./routes/tts.js";
import { registerStaticRoutes } from "./routes/static.js";
import { port as defaultPort } from "./services/runtime.js";
import { applyBinDirToPath } from "./services/deps.js";
import { listTaskIds } from "./services/taskStore.js";
import { cleanupOrphanArtifacts } from "./services/cleanup.js";

const app = Fastify({ logger: false });

applyBinDirToPath();

cleanupOrphanArtifacts(listTaskIds());

await app.register(cors, { origin: true });

registerHealthRoutes(app);
registerGenerateRoutes(app);
registerStreamRoutes(app);
registerTaskRoutes(app);
registerMediaRoutes(app);
registerTtsRoutes(app);
const webDir = registerStaticRoutes(app);

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || defaultPort);

app.listen({ host, port }, (err) => {
  if (err) throw err;
  console.log(`[server] listening on http://${host}:${port}${webDir ? ` (static: ${webDir})` : ""}`);
});
