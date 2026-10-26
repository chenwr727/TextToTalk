# Changelog

本项目所有值得记录的变更都会汇总在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **仓库级工程化工具链**：根目录新增 `package.json`（ESLint 扁平配置 + Prettier + `node:test`），提供 `lint` / `format` / `typecheck` / `test` / `verify` 五个统一入口，不必再进子目录跑脚本。
- **后端单元测试（88 项）**：覆盖 `normalize` 的归一化与内容校验、`prompts` 模板拼装、渲染日志与进度解析、`web/src/*-shim.ts` 对 Remotion API 的覆盖率。
- **前端组件测试环境（Vitest + jsdom + Testing Library，11 项）**：`web` 新增 `test` / `test:watch` 脚本，根目录 `pnpm test` 会先后跑后端与前端。用例锁定了 SSE 订阅生命周期（父组件换新回调不得重订阅）、流式回调取最新闭包、大纲同页数重生成时的草稿刷新、编辑内容不被覆盖，以及定位高亮的收尾时序。
- **shim 覆盖率守护测试**：从 `web/src` 出发遍历真实 import 图，校验每个被前端间接用到的 `remotion` / `@remotion/*` 具名导入都在对应桩文件里有同名导出——升级 Remotion 时漏补桩会直接红灯，而不是静默把缩略图画错。
- **页面级视觉参数 `accent` / `decor`**（AI 可选的受限视觉旋钮）：`accent` 取 0~5 指定本页主色（用于「按章节换色」），`decor` 取 `full` / `quiet` 控制背景装饰强度。prompt 两遍都给了取值规则与使用建议，`normalize` 负责越界收敛与告警，渲染端通过旋转调色板 CSS 变量实现，21 处 `accentOf(i)` 调用与所有语义色自动跟随。
- 页面视觉参数的单测（4 项）：取值边界、非法值告警、字段贯通到 `StoryPage`。
- **成片后的「逐页预览」与「去改这页」入口**：渲染完成后逐页抽出静帧（复用早已存在、但前端从未调用过的 `/preview-frames` 接口），点任意一页即可跳回分镜并定位高亮到该页。此前 `StoryboardPreview` 的 `focusPage` 滚动高亮能力没有任何产品入口，等于死代码。
- 新增组件测试（3 项）锁定逐页预览入口：成片就绪才请求预览帧、点第 N 页传回 1 基页码、未完成时不请求。
- **源码级颜色令牌守护测试**：全仓库扫描「颜色变量 + hex 后缀」的写法与硬编码主题色，直接把这类静默失效变成红灯（见下方修复）。
- `server/scripts/stills.mjs` 支持 `STILL_ONLY=<关键字>` 只渲指定静帧，便于单页回归。
- **手绘标注 `effects.annotation` 真正生效**：`highlight` / `underline` / `circle` 三种手绘强调由 `@remotion/rough-notation` 画在页面标题上。这个字段在 prompt、`types.ts`、`normalize.ts` 里都存在，唯独渲染端从未读取过——是「AI 想表达却表达不出来」的典型。实现走上下文（`AnnotationContext`），21 个场景一行都不用改。
- **逐词高亮字幕（karaoke）**：字幕气泡里的字按语音时长依次点亮，未读到的为半透明灰，数字/百分比读到时转琥珀色加粗。中文按字、英文与数字按词切分，标点并入前一个 token，避免行首逗号单独变色。
- **片头 / 片尾 / 章节页的氛围光**：真实拍摄画面永远有光，纯 CSS 版面永远干净均匀——这是「像视频」与「像 PPT」的分水岭之一。光带 + 双色光晕完全由帧数驱动，无随机、无外部依赖。
- **display 字体层**：新增 `server/scripts/fetch-fonts.mjs` 一次性下载思源黑体（Noto Sans SC 700）与 Sora 700 到 `server/render/public/fonts/`（约 2.4 MB，随仓库入库以保证离线渲染一致），渲染时用 `delayRender` 等字体就绪再出帧，字体缺失则静默回退系统字体栈。标题与大数字走 `--ttt-font-display`，`warm` 主题保持宋体以免被黑体劫持。
- `web` 侧补齐 `delayRender` / `continueRender` / `staticFile` 桩：缩略图不等字体，也不会因为缺导出而报错。
- **生成式版式 `layout: "code"`（受约束的 codegen）**：AI 可以直接写一页 React 组件来画，突破"13 种版式 + 5 种 art + 8 种图表"的表达上限。安全边界是硬性的——
  - 服务端 `services/codePage.ts` 用 TypeScript AST 校验：禁 `import` / 动态 `import()` / `require` / `eval` / `Function`，禁 `window` / `document` / `fetch` / `localStorage`，禁 `setTimeout` / `requestAnimationFrame` / `Date.now` / `Math.random`（逐帧渲染要求同一帧永远同一画面）；超长（>12000 字符）直接拒；
  - 校验通过后转译为纯 JS 存进 `page.code`，渲染端用 `new Function` 注入 `React` / `Kit` / `remotion` 三个参数执行，**生成代码拿不到模块系统、拿不到宿主环境**；
  - 校验失败或运行期异常一律**降级成 points 版式**，并把原因写进重试提示，不会让整条流水线因一页 AI 代码而失败；
  - 新增 `Kit` 能力层（`Heading` / `Card` / `Stat` / `Pill` / `Text` / `Row` / `Col` / `Icon` + 主题色与字号令牌）：生成页面必须用令牌而非写死十六进制，深浅主题都能正常显示。
- 生成式版式的 15 项测试：9 项守门（越权 API、非确定性 API、语法错误、超长、同名字段误杀）+ 3 项归一化贯通（合法保留、缺字段降级、越权降级）+ 3 项 prompt 约束。
- 大纲阶段把 `code` 纳入 layout 枚举并限流（全片最多 2 页、不得用于封面/结尾），避免模型把它当成万能版式滥用。
- `stills.mjs` 增加生成式版式的静帧镜头，用真实"校验 → 转译 → new Function → Kit 渲染"链路验证。
- `web` 新增 `typecheck` 脚本，根目录 `pnpm run typecheck` 可同时检查前后端。
- **端到端验证脚本 `server/scripts/e2e.mts`**：真实文案 → 真实模型 → 分镜 → 每页静帧 →（可选）配音与 MP4，并打印可核对指标（版式选择、每页重试次数、生成式版式的校验通过率）。`E2E_FORCE_CODE` 可强制某页走生成式版式，用来隔离"模型愿不愿意选"与"能不能写对"两个变量；`E2E_REUSE` 复用分镜只重跑渲染。脚本内的两份真实题目放在 `server/scripts/prompts/`。

### 修复

- **LLM 流式请求遇到瞬时断流时整体重试**：端到端跑真实模型时，生成式版式那页上万字符的输出过程中网关偶发 `other side closed`（`UND_ERR_SOCKET`），一次抖动就让整条生成失败、用户白等一分多钟。现在只重发瞬时错误（socket 断开 / `ECONNRESET` / `ETIMEDOUT` / 429 / 5xx），4xx 一律不重发（重发只是白烧额度），首次 + 2 次重试，调用方 abort 后不再发；`onRetry` 让上层清掉已收到的半截文本。5 项测试覆盖各分支。
- **`Kit.Icon` 挂错组件导致生成页图标错位**：原先把"页面右上角绝对定位装饰" `IconView` 当成内联图标暴露给生成代码，AI 写 `Kit.Pill icon="alert"` 时那个图标会飘到页面另一处。现在 `Kit.Icon` 是内联图标，角落装饰另给 `Kit.CornerIcon`，提示词里也写明区别。
- **生成式版式一度形同虚设**：初始提示词只有消极约束（"无法用现有版式表达时才用"），连跑两个题目模型一次都没选它。改为给出正向触发（同心/环形分层、同一对象的多层剖面、两块内容之间的动态关系、需要精确坐标的非规则排布），并划清与 `customSvg` 的分工（后者只能静态摆 2D 图元、不能按帧动画、复用不了卡片体系）。改后同一题目模型主动选用且一次通过校验。

### 变更

- `renderService.renderTaskSync` 里约 60 行的子进程日志/进度管道抽成 `services/renderProgress.ts`（`createRenderLogger` + `parseRenderProgress`），行为不变但可单测。
- 全仓库统一 Prettier 格式（一次性重排，无逻辑改动）。
- **主题从「只换背景」升级为完整设计语言**：`theme.ts` 重构为 `THEME_TOKENS`（字体栈、主色与 6 色强调序列、卡面/胶囊底色、圆角、阴影、装饰色、标题形态）+ `themeVars()` 注入 CSS 变量。场景里 22 个文件、290 处 `C` / `RADIUS` / `CARD_SHADOW` / `FONT` 引用无需逐个改 hook，换主题即整体生效。`server/render` 与 `web` 的预览缩略图各自在根节点注入同一份变量。
  - 5 套主题现在真的不一样：科技蓝（默认黑体 + 胶囊标题 + 24px 圆角）、商务蓝（左对齐竖线标题 + 10px 直角 + 收窄阴影）、清新绿（圆体字 + 34px 大圆角 + 更大字距）、暖橙（宋体衬线 + 纯文字标题 + 6px 直角）、深空（浅字深卡玻璃质感 + 加深阴影）。
  - 深色主题的文字、卡面、装饰色不再沿用浅色主题的硬编码白底。
- `web` 的主题下拉框改为从 `THEME_TOKENS` 读取中文名，不再手写一份会漂移的选项列表。
- `server/render/scripts/bundle.mjs` 支持 `publicDir`：此前打包不复制 `public/`，`staticFile("fonts/…")` 取不到字体（缺目录时自动忽略，不影响无字体的环境）。
- `stills.mjs` 默认打开字幕，并新增手绘标注与 karaoke 中段镜头——这三项改动的观感回归都靠静帧覆盖。

### 修复

- **散点图（scatter）永远不渲染**：`normalizeChart` 的 labels/values 等长校验排在 scatter 分支之前，导致只给 `points` 的散点图被直接判空——渲染端的 `ScatterScene` 实际是死代码。
- **堆叠柱状图（stacked-bar）同理**：只给 `series`、不给顶层 `values` 时被判空。
- **要点 anchor 顺序校验失效**：先排序再比较等同于自比，`anchor 顺序错乱` 这条告警永远不会触发。
- `normalizeArt` 接受 `"pyramid"`，但 `Art` 类型与 `validatePlan` 都不认可（pyramid 属于 chart 而非 art），prompt 里 art 的举例也一并纠正。
- **分镜页「定位到指定页」实际从未生效**：`focusPage` 收尾 effect 在 `highlight` 为空时就立即回调父组件，父组件随即清空 `focusPage`，本 effect 的 cleanup 随即清掉定时器，滚动与高亮都不会发生。改为高亮结束后再回调。
- **重新生成大纲且页数不变时预览不刷新**：大纲同步 effect 只比较页数，且闭包内读到的是旧的 `outline` / `draft`，同页数重生成会沿用旧草稿；而一旦补齐依赖又会在用户编辑时覆盖输入。改为按 `outline` 引用在渲染期同步草稿。
- **`points` 版式从不显示页面标题**：`PointsScene` 既不渲染 `PageHeading` 也不读 `page.title`，AI 为每页写的标题在最常见的版式上被静默丢弃。现已补上标题，并把内容起始边距让出标题所需高度。
- **图表页同理会丢掉页面标题**：8 种图表只画 `chart.title`。现在页面标题走主题的标题语言（与其它版式一致），`chart.title` 降为副标题保留「这组数据在比什么」；标题放在内容流的列里而不是绝对定位，不会压住图形。
- **主题化导致的一批颜色静默失效**：把颜色改成 CSS 变量后，`${color}cc`、`${a}1a` 这类「变量 + hex 后缀」的写法会得到 `var(--ttt-a1)cc` 这种非法值，浏览器整条声明丢弃且不报错——表现为图表只剩第一根柱子、卡片淡色底/辉光/阴影凭空消失。全仓库 22 行、36 处统一改为 `alpha(color, pct)`（内部走 `color-mix`），并加源码级守护测试防止复发。
- **装饰色与卡片边框仍硬编码自身主色的 rgba**：5 套主题的装饰环、光晕、卡边框都不跟随页面级 `accent`；改为由主色推导。另修 `TableScene` / `EndScene` / `SmartArt` 里 4 处硬编码的旧主题蓝。
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
