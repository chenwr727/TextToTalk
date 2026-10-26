# Changelog

本项目所有值得记录的变更都会汇总在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **仓库级工程化工具链**：根目录新增 `package.json`（ESLint 扁平配置 + Prettier + `node:test`），提供 `lint` / `format` / `typecheck` / `test` / `verify` 五个统一入口，不必再进子目录跑脚本。
- **后端单元测试（88 项）**：覆盖 `normalize` 的归一化与内容校验、`prompts` 模板拼装、渲染日志与进度解析、`web/src/*-shim.ts` 对 Remotion API 的覆盖率。
- **前端组件测试环境（Vitest + jsdom + Testing Library，11 项）**：`web` 新增 `test` / `test:watch` 脚本，根目录 `pnpm test` 会先后跑后端与前端。用例锁定了 SSE 订阅生命周期（父组件换新回调不得重订阅）、流式回调取最新闭包、大纲同页数重生成时的草稿刷新、编辑内容不被覆盖，以及定位高亮的收尾时序。
- **shim 覆盖率守护测试**：从 `web/src` 出发遍历真实 import 图，校验每个被前端间接用到的 `remotion` / `@remotion/*` 具名导入都在对应桩文件里有同名导出——升级 Remotion 时漏补桩会直接红灯，而不是静默把缩略图画错。
- `web` 新增 `typecheck` 脚本，根目录 `pnpm run typecheck` 可同时检查前后端。

### 变更

- `renderService.renderTaskSync` 里约 60 行的子进程日志/进度管道抽成 `services/renderProgress.ts`（`createRenderLogger` + `parseRenderProgress`），行为不变但可单测。
- 全仓库统一 Prettier 格式（一次性重排，无逻辑改动）。
- **主题从「只换背景」升级为完整设计语言**：`theme.ts` 重构为 `THEME_TOKENS`（字体栈、主色与 6 色强调序列、卡面/胶囊底色、圆角、阴影、装饰色、标题形态）+ `themeVars()` 注入 CSS 变量。场景里 22 个文件、290 处 `C` / `RADIUS` / `CARD_SHADOW` / `FONT` 引用无需逐个改 hook，换主题即整体生效。`server/render` 与 `web` 的预览缩略图各自在根节点注入同一份变量。
  - 5 套主题现在真的不一样：科技蓝（默认黑体 + 胶囊标题 + 24px 圆角）、商务蓝（左对齐竖线标题 + 10px 直角 + 收窄阴影）、清新绿（圆体字 + 34px 大圆角 + 更大字距）、暖橙（宋体衬线 + 纯文字标题 + 6px 直角）、深空（浅字深卡玻璃质感 + 加深阴影）。
  - 深色主题的文字、卡面、装饰色不再沿用浅色主题的硬编码白底。
- `web` 的主题下拉框改为从 `THEME_TOKENS` 读取中文名，不再手写一份会漂移的选项列表。

### 修复

- **散点图（scatter）永远不渲染**：`normalizeChart` 的 labels/values 等长校验排在 scatter 分支之前，导致只给 `points` 的散点图被直接判空——渲染端的 `ScatterScene` 实际是死代码。
- **堆叠柱状图（stacked-bar）同理**：只给 `series`、不给顶层 `values` 时被判空。
- **要点 anchor 顺序校验失效**：先排序再比较等同于自比，`anchor 顺序错乱` 这条告警永远不会触发。
- `normalizeArt` 接受 `"pyramid"`，但 `Art` 类型与 `validatePlan` 都不认可（pyramid 属于 chart 而非 art），prompt 里 art 的举例也一并纠正。
- **分镜页「定位到指定页」实际从未生效**：`focusPage` 收尾 effect 在 `highlight` 为空时就立即回调父组件，父组件随即清空 `focusPage`，本 effect 的 cleanup 随即清掉定时器，滚动与高亮都不会发生。改为高亮结束后再回调。
- **重新生成大纲且页数不变时预览不刷新**：大纲同步 effect 只比较页数，且闭包内读到的是旧的 `outline` / `draft`，同页数重生成会沿用旧草稿；而一旦补齐依赖又会在用户编辑时覆盖输入。改为按 `outline` 引用在渲染期同步草稿。
- **`points` 版式从不显示页面标题**：`PointsScene` 既不渲染 `PageHeading` 也不读 `page.title`，AI 为每页写的标题在最常见的版式上被静默丢弃。现已补上标题，并把内容起始边距让出标题所需高度。
- **白色卡面写死**：`CustomSvgScene` / `TableScene` / `SmartArt` 里三处 `#fff` / `rgba(255,255,255,0.92)` 卡面改为 `GLASS.card`，否则深色主题上会出现白块。

### 清理

- 删除 `server/render/src/gen/` 下 8 个陈旧生成入口、`server/render-profile/` 空任务目录，以及调试期遗留的 `server.repro.log` / `web/vite.repro.log`。

## [0.2.0] - 2026-09-02

### 新增

- **TTS 多引擎配音**：从单一 Edge 在线语音升级为可配置的多引擎架构，支持 4 种引擎：
  - **Edge 在线语音**（免密钥，默认）
  - **阿里云百炼 CosyVoice**
  - **阿里云百炼 Qwen-Audio-TTS**
  - **火山引擎 Seed-TTS**（含 fetch 失败自动回退 curl 的逻辑）
- 新增 `server/tts.config.json`：引擎 / 音色全部由配置驱动，新增模型只需改配置、无需改代码。
- 新增 `/tts/engines` 接口，前端可动态获取可用引擎与音色列表。
- 新增 `docs/TTS.md`，完整说明各引擎配置、音色、语速音量与扩展方式。
- 渲染设置面板支持选择引擎 / 音色 / 语速 / 音量，并支持二次渲染。

### 变更

- 渲染流程改用 `@remotion/renderer` 的 JS API 直接渲染（`run-render.mjs`），替代原 `remotion-cli` 子进程调用。
- 新增 Chromium 自动探测（`chromium.ts`），自动定位系统 Edge / Chrome。
- 新增启动时清理孤儿渲染产物（`cleanup.ts`）。
- 渲染输出增加落盘校验，防止参数写错导致不落盘。
- 依赖从 `playwright` 改为 `playwright-core`，`tsx` 移入生产依赖。
- 桌面端打包去掉 NSIS 安装程序，仅输出免安装 zip 包。
- 桌面端支持用户级 `tts.config.json` 初始化，动态收集 TTS 引擎所需环境变量。

### 文档

- 新增 `docs/TTS.md`。
- 更新 `API.md` / `ARCHITECTURE.md` / `CONFIGURATION.md` / `DEPLOYMENT.md` / `DESKTOP.md`。

## [0.1.0] - 2026-08-01

### 新增

- 首个可用版本：粘贴文案或链接，自动生成「PPT 式」科普讲解视频。
- 四步流程：文案脚本 → 大纲生成（SSE 流式）→ 分镜预览 → 渲染成片（MP4）。
- 16 个场景组件 + 26 条分发规则，自动匹配版式。
- 纯 Node 数学合成背景音乐（WAV），结构化 SVG 离线圈地图，零素材依赖。
- 分镜缩略图直接复用服务端真实 Remotion 场景组件渲染。
- 链接直接进，静态页内置 fetch，JS 动态页回退 Playwright。
- Electron 桌面版开箱即用，内置 ffmpeg，支持免安装模式。
