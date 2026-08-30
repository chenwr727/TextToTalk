<div align="center">

# 🎬 TextToTalk

**一段文案，或者一个链接 —— 自动变成一集「PPT 式」科普讲解视频。**

粘贴文案 → AI 规划大纲（可编辑）→ 逐页展开分镜 → 配解说 / 字幕 / 背景乐 → 导出 MP4

![Node](https://img.shields.io/badge/Node-22%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4-000000?logo=remotion&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-桌面版-47848F?logo=electron&logoColor=white)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

</div>

---

## 效果演示

<div align="center">

<video src="https://github.com/user-attachments/assets/ac7f4cf8-7ca5-4cc0-a854-771effc233e9" width="100%" controls playsinline></video>

**一镜到底、无剪辑：粘贴文案 → AI 出大纲 → 逐页展开分镜 → 渲染导出 MP4**

</div>

---

## 30 秒上手

三种运行方式，挑一个：

### Docker（想立刻跑起来）

```bash
git clone https://github.com/<你的用户名>/TextToTalk.git
cd TextToTalk
cp server/.env.example server/.env    # 至少填 LLM_API_KEY
docker compose up -d --build          # 构建完打开 http://localhost:8080
```

### 本地开发（要改代码）

```bash
cd server && pnpm install && pnpm approve-builds && pnpm run dev   # :4000
cd server/render && npm install                                     # 渲染工程
cd web && pnpm install && pnpm run dev                              # :3000
```

### 桌面版（当普通软件用）

下载 `TextToTalk-0.1.0-win.zip` 解压即用，无需 Node、无需 Docker、ffmpeg 已内置。

> 完整说明见 [部署与开发](docs/DEPLOYMENT.md) · [桌面版](docs/DESKTOP.md) · [配置](docs/CONFIGURATION.md)

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

- 🖥️ **桌面版开箱即用**
  Electron 封装，内置 ffmpeg，设置面板配好 Key 就能用；也支持[免安装模式](docs/DESKTOP.md#免安装版)，整个文件夹拷 U 盘带走。

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

## 文档

| 文档 | 内容 |
|---|---|
| [部署与开发](docs/DEPLOYMENT.md) | Docker 一键起、本地开发三终端、环境要求、生产注意事项 |
| [桌面版](docs/DESKTOP.md) | 开发模式、打包流程与自检、免安装版、设置面板、常见问题 |
| [配置](docs/CONFIGURATION.md) | LLM / 渲染环境变量、桌面版配置、渲染加速 |
| [API](docs/API.md) | 接口列表、鉴权、SSE 事件 |
| [架构](docs/ARCHITECTURE.md) | 整体结构、项目结构、技术栈、生成与渲染流水线 |

---

## 已知限制

- 目前**仅支持 1920×1080 横屏**（9:16 竖屏已预埋但尚未开放）。
- 任务状态存于内存，TTL 24 小时，重启进程会丢失；适合单机 / 小团队自用，非多实例生产架构。
- TTS 走 Edge 在线服务，需要外网；音色以中文为主。
- 渲染是逐帧 CPU 密集任务，成片时长越长等待越久（见[渲染加速](docs/CONFIGURATION.md#渲染加速)）。
- 桌面版打包时跳过了 Playwright 浏览器下载，**抓取 JS 动态页的兜底能力不可用**，静态页抓取不受影响。

---

## Roadmap

- [ ] 9:16 / 1:1 竖屏与方形画幅
- [ ] 任务持久化（SQLite）与多实例渲染 worker
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
