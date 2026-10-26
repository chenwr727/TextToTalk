import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * 前端单元测试配置。
 * 复用 vite.config.ts 里的 alias（remotion → *-shim.ts），因此测试里 import 到的
 * 服务端场景组件会被同一套桩替换，与浏览器运行时行为一致。
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      clearMocks: true,
      restoreMocks: true,
    },
  }),
);
