import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      remotion: path.resolve(dirname, "src/remotion-shim.ts"),
      "@remotion/rough-notation": path.resolve(dirname, "src/rough-notation-shim.ts"),
      "@remotion/paths": path.resolve(dirname, "src/paths-shim.ts"),
      "@remotion/media-utils": path.resolve(dirname, "src/media-utils-shim.ts"),
      "@remotion/layout-utils": path.resolve(dirname, "src/layout-utils-shim.ts"),
      "@remotion/shapes": path.resolve(dirname, "src/shapes-shim.ts"),
      react: path.resolve(dirname, "node_modules/react"),
      "react/jsx-runtime": path.resolve(dirname, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(dirname, "node_modules/react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(dirname, "node_modules/react-dom"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
