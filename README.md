<div align="center">

# 🎬 TextToTalk

**一段文案，或者一个链接 —— 自动变成一集「PPT 式」科普讲解视频。**

粘贴文案 → AI 规划大纲（可编辑）→ 逐页展开分镜 → 配解说 / 字幕 / 背景乐 → 导出 MP4

![Node](https://img.shields.io/badge/Node-22%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4-000000?logo=remotion&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-一键起-2496ED?logo=docker&logoColor=white)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

</div>

---

## 效果演示

<div align="center">

<video src="https://github.com/user-attachments/assets/ac7f4cf8-7ca5-4cc0-a854-771effc233e9" width="100%" controls playsinline></video>

**一镜到底、无剪辑：粘贴文案 → AI 出大纲 → 逐页展开分镜 → 渲染导出 MP4**

</div>

---

## 它解决什么问题

做一集 3 分钟的科普讲解视频，通常要过五关：写稿 → 做 PPT → 配图 → 录音 → 剪辑。
TextToTalk 把中间三步压缩成一次回车：

| 传统方式 | TextToTalk |
|---|---|
| 手写脚本、手动分页 | LLM 按「叙事弧线」自动切 2~10 页，每页带角色定位 |
| 找图、画图表、调版式 | 26 条场景规则自动分发版式，图表 / 地图 / SmartArt 直接生成 |
| 自己录音或买配音 | Edge-TTS 逐句合成，字幕随语音节奏出现 |
| 剪辑软件拼轨道 | Remotion 无头渲染，一次出带声 MP4 |

**你只需要保留两件事的判断权：大纲对不对、这一页要不要重做。**

---

## 为什么不是又一个「AI 视频生成器」

- 🧭 **大纲先行，而不是黑盒直出**
  先出全局大纲（每页的核心信息 + 版式 + 角色 + 节奏），流式流出、可增删页 / 上下移页 / 逐页改版式。确认后才展开分镜——**在花时间渲染之前就把方向定对**。

- 🎯 **逐页重做，而不是整片重抽**
  第 5 页不满意？单独重新生成、或就地编辑标题 / 解说 / 要点 / 时长 / 版式。改完自动作废旧成片，状态回到可再渲染。

- 🧱 **零素材依赖，纯代码画一切**
  背景音乐是**纯 Node 数学生成**的 WAV（琶音 + 低音 + 包络，无任何音频素材）；地图是**结构化 SVG**（标记点 / 航线 / 区域多边形），**不调用任何在线地图服务**；图表、图示、图标全是矢量绘制。

- 🖼️ **预览即成片**
  分镜缩略图不是「示意图」，而是**直接复用服务端真实的 Remotion 场景组件**渲染的，1920 设计宽等比缩放——看到什么就导出什么。

- 🔗 **链接直接进，公众号也能抓**
  贴 URL 自动抓正文；静态页走内置 fetch，JS 动态渲染页（公众号 / 知乎等）自动回退 Playwright 真浏览器。

- 🐳 **一条 Docker 命令跑全套**
  镜像内置 nginx + Node 后端 + Chromium + 中文字体 + ffmpeg + Playwright 内核，国内源已配好。

---

## 30 秒上手（Docker）

```bash
git clone https://github.com/<你的用户名>/TextToTalk.git
cd TextToTalk

cp server/.env.example server/.env    # 至少填 LLM_API_KEY
docker compose up -d --build          # 构建完打开 http://localhost:8080
```

粘贴一段文案，点生成，等一杯咖啡的时间就能下载 MP4。

<details>
<summary>Docker 常用命令</summary>

```bash
docker compose logs -f app   # 看后端日志
docker compose down          # 停止（数据保留在 ./server/out、./server/assets）
docker compose up -d --build # 改完代码重建
```

- 端口默认 `8080:80`，改 `docker-compose.yml` 的 `ports` 即可。
- 成片、音频、TTS 缓存以 **bind mount** 挂载到宿主机（`./server/out`、`./server/assets`、`./server/tts`），重建容器不丢。
- 镜像已配 npm（npmmirror）与 Alpine（清华 TUNA）国内源，Playwright 内核走 npmmirror 镜像。
- 单容器：nginx 监听 80 反代 `/api`，后端监听 4000。

</details>

---

## 本地开发

三个工程各起一个终端：

```bash
# 1) 后端  http://localhost:4000
cd server && pnpm install
cp .env.example .env
pnpm approve-builds            # 放行 esbuild / msedge-tts 安装脚本（pnpm v10+ 必需）
pnpm run dev                   # tsx watch 热载

# 2) 渲染工程（独立的 Remotion 工程，npm / pnpm 均可）
cd server/render && npm install

# 3) 前端  http://localhost:3000（已配 /api 代理到 :4000）
cd web && pnpm install && pnpm run dev
```

> **环境要求**：Node **20.19+ / 22.12+**（推荐 22 或 24，Docker 镜像为 `node:24-alpine`）、pnpm 9+、ffmpeg + ffprobe（TTS 与抽帧依赖）。
> **Playwright 内核**仅「抓 JS 动态页」时需要：`npx playwright install chromium`。
> 首次渲染较慢（Remotion 逐帧导出），几十秒到一分钟；想提速见 [渲染加速](#渲染加速)。

---

## 四步流程

```
┌── 文案脚本 ──┐   ┌── 大纲生成 ──┐   ┌── 分镜预览 ──┐   ┌── 渲染成片 ──┐
│ 粘贴文案     │   │ Pass 1       │   │ Pass 2       │   │ TTS 逐句合成 │
│ 或文章链接   │──▶│ 叙事弧线     │──▶│ 逐页展开     │──▶│ BGM 按时长   │
│ 选语气/粒度  │   │ 可编辑·可重抽│   │ 可单页重做   │   │ 逐帧导出 MP4 │
│ 主题/音色/乐 │   │ SSE 流式流出 │   │ 真实缩略图   │   │ 在线播放/下载│
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

1. **文案脚本** —— 粘贴文案 / 一键示例 / 直接贴链接抓正文；选语气、拆稿粒度、主题风格、配音音色、配乐与字幕，还可补充「目标受众 / 核心信息 / 观众收获」让 AI 更贴题。
2. **大纲生成** —— AI 先规划全局叙事弧线，逐页给出核心信息与版式建议，SSE 流式流出；可重新生成，或增删改页后再确认。
3. **分镜预览** —— 基于确认的大纲逐页展开标题 / 要点 / 解说 / 字幕 / 转场 / 动效，实时看真实版式缩略图，每页可单独重做。
4. **渲染成片** —— 合成配音 + 配乐 + 字幕，输出 MP4，支持在线流式播放（HTTP Range）与下载；失败可定位到具体出错页。

---

## 画面能力

16 个场景组件 + 26 条分发规则，由页面字段自动匹配，**不需要你手动挑模板**。

| 维度 | 取值 |
|---|---|
| **layout** 版式（13） | `title` 封面 · `section` 章节 · `points` 要点 · `three_card` 三卡片 · `comparison` 对比 · `chart` 图表 · `table` 表格 · `two_column` 左右图文 · `steps` 步骤流程 · `stats` 数据大屏 · `qa` 问答 · `map` 地图 · `end` 总结 |
| **chart** 图表（8） | `bar` 柱状 · `line` 折线 · `pie` 饼图 · `donut` 环形 · `area` 面积 · `stacked-bar` 堆叠 · `scatter` 散点 · `pyramid` 金字塔 |
| **art** SmartArt（5） | `flow` 流程 · `loop` 循环 · `timeline` 时间线 · `quadrant` 象限 · `quote` 金句 |
| **customSvg** 自由图示 | LLM 直接输出 SVG 元素数组（`circle/rect/path/polygon/text...`，2~40 个，支持逐元素 `delay` 与 `draw` 描边动画），可画神经网络、分层架构、决策树等任意示意图；**优先级高于所有 layout** |
| **map** 离线圈地图 | `markers` 标记点（2~8）· `routes` 路线（`rail/flight/road`，可虚线 / 动画 / 流光）· `regions` 区域多边形；纯 SVG，不依赖在线地图服务 |
| **transition** 转场（5） | `fade` · `slide-left` · `slide-right` · `zoom` · `none` |
| **motion** 动画（3） | `spring` 弹簧 · `linear` 线性 · `float` 浮动 |
| **effects** 特效（3） | `annotation` 手绘标注（高亮 / 下划线 / 圆圈）· `pathDraw` 路径描边 · `threeD` 3D 翻转入场 |
| **icon** 图标（35） | 每页一枚语义徽章：`trend chart clock scale gear bulb question alert check search target rocket heart shield db globe book bolt star flag link users wallet box layers code pie calendar map cloud lock eye compass home award` |
| **role** 角色（12） | `hook` 开场 · `familiar` 铺垫 · `puzzle` 疑问 · `build` 概念 · `mechanism` 机制 · `scale` 量级 · `evidence` 证据 · `case` 案例 · `compare` 对比 · `why` 价值 · `action` 行动 · `end` 收尾 |
| **rhythm** 节奏（3） | `anchor` 重点 · `dense` 密集 · `breathing` 过渡缓冲 |

### 生成参数

| 参数 | 可选值 |
|---|---|
| 语气 `tone` | `formal` 正式严谨 · `casual` 轻松易懂（默认）· `energetic` 活泼有感染力 |
| 拆稿粒度 `granularity` | `coarse` 2~4 页 · `medium` 4~6 页（默认）· `fine` 6~10 页 |
| 主题风格 `theme` | `tech` 科技蓝（默认）· `business` 商务蓝 · `fresh` 清新绿 · `warm` 暖橙 · `dark` 深空 |
| 配音音色 `voice` | `zh-CN-XiaoxiaoNeural` 晓晓·女（默认）· `YunxiNeural` 云希·男 · `YunyangNeural` 云扬·新闻 · `XiaoyiNeural` 晓伊·活泼 · `liaoning-XiaobeiNeural` 晓北·东北 |
| 背景配乐 `bgm` | `default` 轻快配乐 · `none` 静音 |
| 画幅 / 帧率 | `1920×1080` @ `30fps`（当前仅横屏 16:9） |
| 沟通目标（可选） | 目标受众 `audience` · 核心信息 `coreMessage` · 观众收获 `audienceOutcome` |

---

## 生成流水线

后端 `storyboardGenerator` 采用「大纲 → 分镜」两段式 LLM 流水线，中间夹一层强类型归一化：

| 阶段 | 作用 |
|---|---|
| **Pass 1 · 大纲规划** | 定全局 `arc` 叙事弧线与每页 `role / icon / layout / art / chart / table / rhythm`，流式流出供确认与编辑 |
| **Pass 2 · 逐页展开** | 基于确认后的大纲逐页填充标题 / 要点 / 解说 / 字幕，注入上一页上下文保持连贯（SSE 实时流出） |
| **normalize** | LLM JSON → 强类型分镜；越界值收敛、缺失字段补全，并产出「某页与大纲版式偏差 / 图表未兑现 / 要点过多」等偏差告警 |
| **fallbackDirect** | 管线异常时直出兜底分镜，保证不中断 |

**渲染阶段**：逐句 TTS（3 并发 + 3 次退避重试）→ 按整片时长合成 BGM → 生成自包含 Remotion 入口 → 无头 Chromium 逐帧导出带声 MP4。

---

## 配置

复制 `server/.env.example` 为 `server/.env`，`tsx` 会自动加载。

### LLM（必填）

| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | **必填**，OpenAI 兼容接口的 Key |
| `LLM_API_URL` | **必填完整 endpoint 路径**，如 `https://api.deepseek.com/v1/chat/completions`；智谱填 `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions` |
| `LLM_MODEL` | 模型名，默认 `deepseek-v4-flash` |
| `LLM_ENABLE_THINKING` | 是否保留模型的 thinking 内容，默认 `false` |

### 渲染（可选）

| 变量 | 默认 | 说明 |
|---|---|---|
| `RENDER_CONCURRENCY` | CPU 核数一半 | 并发导帧数。多核可设为核数；`=1` 最稳（低内存 / 受限容器） |
| `RENDER_SCALE` | 不设置 | `<1` 降分辨率以提速，适合草稿预览；终版不要设 |
| `RENDER_GL` | `swiftshader` | 本机有独显时设 `angle` 走 WebGL 硬件加速 |
| `RENDER_HW_ACCEL` | `0` | 硬件编解码开关 |
| `RENDER_MAX_TASKS` | `1` | 渲染队列并发上限 |
| `RENDER_X264_PRESET` | `veryfast` | x264 编码预设 |
| `CHROME_PATH` | 自动探测 | 指定 Chromium 可执行文件（Docker 内已指向 `/usr/bin/chromium`） |

---

## 渲染加速

渲染是逐帧完整 Chromium 截图，耗时 ≈ **分辨率 × 帧数**。按收益排序：

1. **多核并发**（首选，默认已开）—— 把 `RENDER_CONCURRENCY` 设为核数（如 8）；内存紧张或受限容器设 `=1`。
2. **GPU 硬件加速** —— 有独显时设 `RENDER_GL=angle`，从软件 `swiftshader` 切到 WebGL，提速明显。
3. **降分辨率跑草稿** —— 设 `RENDER_SCALE=0.75`（约 1440×810）校对效果，确认后去掉再出终版。
4. **降低帧率** —— `fps` 从 30 降到 24 / 15，帧数近乎线性下降，PPT 讲解类完全可接受。

> 以上变量改完无需重启前端，`tsx watch` 已热载后端。

---

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/generate` | 一步式创建生成任务 `{ prompt, params }` → `{ taskId, token }`；`prompt` 可为文案或链接 |
| POST | `/api/outline` | **第一步**仅生成大纲（Pass 1），SSE 回流 `meta / token / stage / section / final` |
| POST | `/api/storyboard` | **第二步**基于已确认大纲 `{ prompt, outline, params }` 创建分镜任务 |
| GET | `/api/tasks/:id` | 查询任务（状态 / 分镜 / 进度 / 告警） |
| GET | `/api/stream?id=&token=` | SSE 订阅生成与渲染进度事件 |
| POST | `/api/tasks/:id/render` | 提交渲染成片 |
| POST | `/api/tasks/:id/pages/:page/regenerate` | 单页重新生成 |
| PATCH | `/api/tasks/:id/pages/:page` | 单页就地编辑（标题 / 旁白 / 字幕 / 要点 / 时长 / 版式） |
| POST | `/api/tasks/:id/preview-frames` | 后台生成各页预览帧 PNG |
| GET | `/api/tasks/:id/frames/:page` | 返回某页预览帧 PNG |
| GET | `/api/tasks/:id/download` | 在线播放（支持 HTTP Range / 206） |
| GET | `/api/tasks/:id/download?download=1` | 下载（`attachment`） |
| GET | `/api/media/*` | TTS / BGM 音频点播（供 Remotion 拉取，支持 Range） |

> 任务类接口需携带创建时返回的 `token`（`?token=` 或 `Authorization: Bearer`），不匹配返回 401。前端封装见 `web/src/api.ts`。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · Vite 8 · TypeScript |
| 后端 | Node.js · Fastify 5 · TypeScript（`tsx watch` 热载） |
| 渲染 | Remotion 4.0（无头 Chromium）· transitions · rough-notation · paths · shapes · media-utils |
| 网页抓取 | Node 内置 fetch（轻量）+ Playwright（JS 动态页兜底） |
| TTS | msedge-tts（Edge 在线音色）+ ffmpeg 转码 |
| BGM | 自研纯 Node 合成（44.1kHz 手写 WAV，无任何音频素材） |
| LLM | OpenAI 兼容接口（`/chat/completions` 流式） |

---

## 项目结构

```
├─ shared/                      # 前后端共享类型契约
├─ web/                         # 前端（React + Vite）
│   └─ src/
│       ├─ App.tsx              # 四步流程壳 + 步骤条
│       ├─ api.ts               # /api 客户端 + SSE 订阅
│       └─ components/          # 输入 / 大纲 / 分镜 / 缩略图 / 渲染 / 页编辑器
└─ server/
    ├─ src/
    │   ├─ index.ts             # Fastify 入口（:4000）
    │   ├─ routes/              # generate / stream / tasks / media / health
    │   └─ services/
    │       ├─ storyboardGenerator.ts  # 大纲 + 多 pass 分镜管线
    │       ├─ prompts.ts / normalize.ts   # prompt 模板 / JSON 归一化与告警
    │       ├─ renderService.ts / entry.ts  # 渲染编排 / Remotion 入口生成
    │       ├─ frameExtract.ts          # 预览帧导出（ffmpeg 优先，remotion still 回退）
    │       ├─ ttsService.ts / bgmService.ts
    │       ├─ fetchUrl.ts / llmClient.ts   # 网页抓取 / LLM 流式客户端
    │       └─ taskStore / sseHub / renderQueue / auth / env
    ├─ render/                  # Remotion 渲染工程
    │   └─ src/shared/render/
    │       ├─ DynamicVideo.tsx # 主组件（TransitionSeries + 转场 + 频谱）
    │       ├─ sceneRegistry.ts # 26 条版式分发规则
    │       └─ scenes/          # 16 个场景组件
    └─ out/  assets/  tts/      # 运行时产物：成片 mp4、预览帧 PNG、TTS / BGM wav
```

---

## 已知限制

- 目前**仅支持 1920×1080 横屏**（9:16 竖屏已预埋但尚未开放）。
- 任务状态存于内存，TTL 24 小时，重启进程会丢失；适合单机 / 小团队自用，非多实例生产架构。
- TTS 走 Edge 在线服务，需要外网；音色以中文为主。
- 渲染是逐帧 CPU 密集任务，成片时长越长等待越久（见 [渲染加速](#渲染加速)）。

---

## Roadmap

- [ ] 9:16 / 1:1 竖屏与方形画幅
- [ ] 任务持久化（SQLite）与多实例渲染worker
- [ ] 更多 TTS 引擎与多语种音色
- [ ] 分镜模板市场与自定义主题配色
- [ ] 成片导出字幕文件（SRT）

欢迎提 Issue 或 PR，想法都可以聊。

---

## 贡献

1. Fork 本仓库，新建分支 `feat/your-idea`
2. `pnpm run typecheck` 通过后再提交
3. 提 PR 时简单说明改动动机与截图（UI 相关必附）

---

## License

[MIT](LICENSE) © TextToTalk contributors

---

<div align="center">

如果这个项目对你有用，点个 ⭐ 就是最大的鼓励。

</div>
