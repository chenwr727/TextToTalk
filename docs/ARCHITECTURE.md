# 架构

- [整体结构](#整体结构)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [生成流水线](#生成流水线)
- [渲染流水线](#渲染流水线)

---

## 整体结构

```
┌──────────┐   /api    ┌──────────┐  spawn  ┌──────────────┐
│  web     │ ────────▶ │  server  │ ──────▶ │ render       │
│ React 19 │           │ Fastify  │         │ Remotion CLI │
│  :3000   │ ◀──────── │  :4000   │ ◀────── │ 无头 Chromium│
└──────────┘    SSE    └──────────┘   mp4   └──────────────┘
```

- `web` 通过 `/api` 相对路径访问后端，开发和生产都不需要改地址
- `server` 用 `spawn` 调起 `render` 工程的 Remotion CLI，渲染是独立进程，不阻塞 API
- 桌面版下 `web` 的构建产物由 `server` 一并托管，两者合并成一个进程组

---

## 项目结构

```
├─ shared/                      # 前后端共享类型契约
├─ desktop/                     # 桌面版外壳（Electron）
│   ├─ src/
│   │   ├─ main.ts              # 主进程：拉起后端 / 窗口 / 菜单 / 设置 IPC
│   │   ├─ server.ts            # 后端子进程管理与健康探测
│   │   ├─ preload.ts           # contextBridge 暴露的设置 API
│   │   ├─ paths.ts             # 资源路径与免安装模式
│   │   ├─ config.ts            # 配置读写（userData/config.json）
│   │   └─ browser.ts           # Chromium / ffmpeg 探测
│   ├─ scripts/
│   │   ├─ make-icon.mjs        # 从 web 的 svg 生成三平台图标
│   │   ├─ copy-ffmpeg.mjs      # 内置 ffmpeg 到 build/bin
│   │   ├─ stage-server.mjs     # 暂存后端（重装依赖 + 过滤产物）
│   │   └─ verify-pack.mjs      # 打包产物自检
│   ├─ assets/settings.html     # 设置面板
│   ├─ portable.txt             # 免安装模式标记（随包发布）
│   └─ electron-builder.yml
├─ web/                         # 前端（React + Vite）
│   └─ src/
│       ├─ App.tsx              # 四步流程壳 + 步骤条
│       ├─ api.ts               # /api 客户端 + SSE 订阅
│       └─ components/          # 输入 / 大纲 / 分镜 / 缩略图 / 渲染 / 页编辑器
└─ server/
    ├─ src/
    │   ├─ index.ts             # Fastify 入口（:4000）
    │   ├─ routes/              # generate / stream / tasks / media / health / static
    │   └─ services/
    │       ├─ storyboardGenerator.ts  # 大纲 + 多 pass 分镜管线
    │       ├─ prompts.ts / normalize.ts   # prompt 模板 / JSON 归一化与告警
    │       ├─ renderService.ts / entry.ts  # 渲染编排 / Remotion 入口生成
    │       ├─ frameExtract.ts          # 预览帧导出（ffmpeg 优先，remotion still 回退）
    │       ├─ ttsService.ts / bgmService.ts
    │       ├─ fetchUrl.ts / llmClient.ts   # 网页抓取 / LLM 流式客户端
    │       ├─ runtime.ts               # 路径与对外基址收口（支持桌面版重定向）
    │       ├─ deps.ts                  # 渲染依赖校验 / WAV 时长解析
    │       └─ taskStore / sseHub / renderQueue / auth / env
    ├─ render/                  # Remotion 渲染工程
    │   └─ src/
    │       ├─ DynamicVideo.tsx # 主组件（TransitionSeries + 转场 + 频谱 + 版式分发）
    │       ├─ shared/render/
    │       │   ├─ scenes/      # 16 个场景组件
    │       │   └─ theme.ts props.ts Card.tsx Icon.tsx Bg.tsx ...
    │       └─ gen/             # 运行时生成的入口（每次渲染覆盖，不入库）
    └─ out/  assets/  tts/      # 运行时产物：成片 mp4、预览帧 PNG、TTS / BGM wav
```

> `server/src/services/runtime.ts` 是关键：它把散落各处的路径与对外基址统一收口，
> 桌面版通过 `TTT_*` 环境变量重定向到 userData，业务代码无需感知运行环境。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · Vite 8 · TypeScript |
| 后端 | Node.js · Fastify 5 · TypeScript（`tsx watch` 热载） |
| 桌面 | Electron 44 · electron-builder |
| 渲染 | Remotion 4.0（无头 Chromium）· transitions · rough-notation · paths · shapes · media-utils |
| 网页抓取 | Node 内置 fetch（轻量）+ Playwright（JS 动态页兜底） |
| TTS | msedge-tts（Edge 在线音色）+ ffmpeg 转码 |
| BGM | 自研纯 Node 合成（44.1kHz 手写 WAV，无任何音频素材） |
| LLM | OpenAI 兼容接口（`/chat/completions` 流式） |

---

## 生成流水线

后端 `storyboardGenerator` 采用「大纲 → 分镜」两段式 LLM 流水线，中间夹一层强类型归一化：

| 阶段 | 作用 |
|---|---|
| **Pass 1 · 大纲规划** | 定全局 `arc` 叙事弧线与每页 `role / icon / layout / art / chart / table / rhythm`，流式流出供确认与编辑 |
| **Pass 2 · 逐页展开** | 基于确认后的大纲逐页填充标题 / 要点 / 解说 / 字幕，注入上一页上下文保持连贯（SSE 实时流出） |
| **normalize** | LLM JSON → 强类型分镜；越界值收敛、缺失字段补全，并产出「某页与大纲版式偏差 / 图表未兑现 / 要点过多」等偏差告警 |
| **fallbackDirect** | 管线异常时直出兜底分镜，保证不中断 |

---

## 渲染流水线

```
逐句 TTS ──▶ 按整片时长合成 BGM ──▶ 生成自包含 Remotion 入口 ──▶ 无头 Chromium 逐帧导出带声 MP4
(3 并发 +     (纯 Node 数学生成      (写入 render/src/gen/)       (并发数由 RENDER_CONCURRENCY 控制)
 3 次退避重试)  琶音+低音+包络)
```

渲染前会先跑一次依赖校验（`services/deps.ts`）：

- 缺 **ffmpeg** → 直接失败并给出准确原因（否则会一路跑到 TTS 全部失败，
  报出误导性的「TTS 合成失败」）
- 缺 **Chromium** → 提示指定浏览器路径；若只是未探测到，则挂一条 warning，
  Remotion 会尝试联网下载自带内核

---

**相关文档**：[部署与开发](DEPLOYMENT.md) · [桌面版](DESKTOP.md) · [配置](CONFIGURATION.md) · [TTS 配音](TTS.md) · [API](API.md)
