import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

/**
 * 仓库级 ESLint 扁平配置（flat config）。
 *
 * 定位：只做「能抓到真问题」的静态检查——语法级错误、无效代码、可疑模式；
 * 格式问题一律交给 Prettier（末尾 appends eslint-config-prettier 关闭所有冲突规则）。
 *
 * 规则等级说明：
 * - error：会导致 CI 变红，只保留确实等于 bug 的规则（重复 key、不可达代码、无效正则等）
 * - warn：风格/历史遗留问题（no-explicit-any、未使用变量等），不阻塞提交
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/*.min.js",
      // 运行时产物 / 打包产物
      "server/render/src/gen/**",
      "server/render-profile/**",
      "desktop/release/**",
      "desktop/build/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // 变量是否存在由 tsc 负责，ESLint 的 no-undef 对 TS 类型引入会误报
      "no-undef": "off",

      // 历史代码里 any 较多：降级为 warn，新增代码逐步收紧
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      // 空 catch 在本项目里是刻意的「尽力而为」语义（清理临时文件、写日志等）
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      "no-console": "off",
    },
  },

  {
    // TSX 需要显式开启 JSX 解析
    files: ["**/*.tsx"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  {
    // 前端组件：hooks 规则能抓到真实的闭包/依赖问题
    files: ["web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  {
    // 构建/工具脚本：允许 require、允许同步 IO
    files: ["**/scripts/**/*.{js,mjs,cjs}", "**/*.config.{js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  prettier,
);
