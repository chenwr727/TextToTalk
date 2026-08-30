import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./routes/health.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerStreamRoutes } from "./routes/stream.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerStaticRoutes } from "./routes/static.js";
import { port as defaultPort } from "./services/runtime.js";
import { applyBinDirToPath } from "./services/deps.js";

const app = Fastify({ logger: false });

applyBinDirToPath();

await app.register(cors, { origin: true });

registerHealthRoutes(app);
registerGenerateRoutes(app);
registerStreamRoutes(app);
registerTaskRoutes(app);
registerMediaRoutes(app);
const webDir = registerStaticRoutes(app);

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || defaultPort);

app.listen({ host, port }, (err) => {
  if (err) throw err;
  console.log(`[server] listening on http://${host}:${port}${webDir ? ` (static: ${webDir})` : ""}`);
});
