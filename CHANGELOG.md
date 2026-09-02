# Changelog

本项目所有值得记录的变更都会汇总在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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