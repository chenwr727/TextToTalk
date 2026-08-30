import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const serverRoot = path.resolve(here, "..", "..");

export const renderDir = process.env.TTT_RENDER_DIR || path.join(serverRoot, "render");

export const outDir = process.env.TTT_OUT_DIR || path.join(serverRoot, "out");

export const assetsDir = process.env.TTT_ASSETS_DIR || path.join(serverRoot, "assets");

export const webDir = process.env.TTT_WEB_DIR || "";

export const port = Number(process.env.PORT || 4000);

export const publicBaseUrl =
  process.env.TTT_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;

export const mediaUrl = (rel: string) => `${publicBaseUrl}/api/media/${rel}`;
