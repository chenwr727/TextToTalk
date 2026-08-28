import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./routes/health.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerStreamRoutes } from "./routes/stream.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerMediaRoutes } from "./routes/media.js";

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });

registerHealthRoutes(app);
registerGenerateRoutes(app);
registerStreamRoutes(app);
registerTaskRoutes(app);
registerMediaRoutes(app);

app.listen({ host: "0.0.0.0", port: 4000 }, (err) => {
  if (err) throw err;
  console.log("server listening on http://localhost:4000");
});