# 桌面版（Electron）

把后端和前端装进一个原生窗口，双击即用——不需要 Docker，不需要预先装 Node。

- [快速开始](#快速开始)
- [打包](#打包)
- [免安装版](#免安装版)
- [它是怎么跑的](#它是怎么跑的)
- [设置面板](#设置面板)
- [常见问题](#常见问题)

---

## 快速开始

### 开发模式

直接跑仓库代码，改完重启即可，无需打包。

```bash
# 1) 准备后端与前端依赖（只需一次）
cd server && pnpm install && pnpm approve-builds
cd server/render && npm install
cd ../../web && pnpm install && pnpm run build

# 2) 启动桌面端
cd ../desktop && npm install && npm run dev
```

开发态有两个便利行为：

- 后端已经跑在 `:4000`（`pnpm dev`）时**直接复用**，不重复拉起，避免端口冲突
- `web` 起了 vite(`:3000`) 时**自动走热更新地址**，改前端不用重启

### 环境要求

| 依赖 | 说明 |
|---|---|
| Node | 20.19+ / 22.12+（推荐 22 或 24） |
| pnpm | 9+ |
| ffmpeg | **已随包内置**，无需自行安装 |
| Chromium | 自动探测系统 Edge / Chrome |

---

## 打包

```bash
cd desktop
npm run dist:win     # Windows zip
npm run dist:mac     # macOS dmg
npm run dist:linux   # Linux AppImage
```

实测产物（Windows，x64）：

| 文件 | 体积 | 说明 |
|---|---|---|
| `TextToTalk-0.2.0-win-portable.zip` | 199 MB | 免安装版，解压即用 |

### 打包自检

打包结束会自动跑 `npm run verify`（`scripts/verify-pack.mjs`），校验：

- **必需项**：`portable.txt`、`app.asar`、`resources/bin/ffmpeg.exe`、前端产物、后端入口、tsx、fastify、msedge-tts、remotion CLI、esbuild、Remotion 主组件
- **排除项**：`out/`、`data/`、`render-profile/`、`assets/tts/`、`assets/bgm/`、`render/src/gen/`

缺一项即判定打包失败。也可以单独跑：

```bash
cd desktop && npm run verify
```

### 打包流程

`npm run dist:win` 依次执行：

| 步骤 | 命令 | 作用 |
|---|---|---|
| 1 | `npm run icon` | 从 `web/public/favicon.svg` 生成 `icon.ico / icon.icns / icon.png` |
| 2 | `npm run ffmpeg` | 把 `ffmpeg-static` 的二进制复制到 `build/bin` |
| 3 | `npm run stage` | 把后端暂存到 `build/resources/payload/server` |
| 4 | `tsc` | 编译主进程与 preload |
| 5 | `electron-builder` | 产出免安装 zip 包 |
| 6 | `npm run verify` | 产物自检 |

第 3 步是关键，它绕开了两个坑：

1. **electron-builder 会丢掉 `server/node_modules`**。它对 extraResources 的
   node_modules 排除规则是 `"/node_modules"`，只锚定 `from` 根目录。直接
   `from: ../server` 会把顶层的 `server/node_modules` 整个丢掉——tsx 启动器在里面，
   装完应用起不来。所以这里多套一层 `payload/`，让它变成嵌套目录。
2. **pnpm 的符号链接打包后会失效**。Windows 下创建符号链接需要特权，
   而解引用又会让 transitive 依赖解析失败（pnpm 靠 realpath 向上找）。
   所以暂存时用 `pnpm install --node-linker=hoisted` 重装一份扁平、无符号链接的依赖树。

排除规则也在这个脚本里用代码显式过滤，比 glob 可靠。

---

## 免安装版

解压 `TextToTalk-0.2.0-win-portable.zip` 后直接双击 `TextToTalk.exe`，不写注册表、不装系统目录。

模式由 exe 同级的 **`portable.txt`** 控制：

| | `portable.txt` 存在 | `portable.txt` 不存在 |
|---|---|---|
| 模式 | 免安装 | 安装 |
| 数据位置 | exe 同级 `UserData/` | `%APPDATA%\texttotalk-desktop` |
| 适用场景 | U 盘携带、多机切换 | 固定机器 |

- 两份数据**互不干扰**，切换模式后各自保留
- 应用目录不可写时（比如解压到了 `Program Files`）会**自动回退**到 `%APPDATA%` 并告警，不会静默失败
- 设置面板底部的「运行模式」会显示当前处于哪种模式

---

## 它是怎么跑的

```
┌─────────────────────────────────────────────┐
│ Electron 主进程                              │
│  setupPortableMode() → 探测空闲端口           │
│         │                                    │
│         ├─ spawn 后端（Electron 自带 Node）    │
│         │    tsx src/index.ts                │
│         │    监听 127.0.0.1:<随机端口>         │
│         │    托管 web/dist                    │
│         │                                    │
│         └─ BrowserWindow                     │
│              loadURL(http://127.0.0.1:<port>)│
└─────────────────────────────────────────────┘
```

- **随机空闲端口**：避免与系统其他服务冲突。因为 Remotion 渲染时要在无头浏览器里回拉
  TTS / BGM 音频，服务端把对外基址收口到 `TTT_PUBLIC_BASE_URL`，不再写死 4000。
- **后端托管前端**：`web/dist` 由后端一并托管，窗口直接加载后端地址，前端的 `/api`
  相对路径不用改。开发模式下不存在 `web/dist` 时不注册，仍走 vite(`:3000`) 代理。
- **配置不再依赖 `server/.env`**：见[设置面板](#设置面板)。
- **成片与音频**落在应用数据目录的 `data/out`、`data/assets`，
  菜单「文件 → 打开输出目录」直达。

### 依赖处理

| 依赖 | 策略 |
|---|---|
| **ffmpeg** | 已内置（`ffmpeg-static`），后端启动时把 `resources/bin` 并入 PATH |
| **ffprobe** | 不再需要。配音时长改由服务端解析 WAV 头得到（省 60MB） |
| **Chromium** | 自动探测系统 Edge / Chrome。都没找到时 Remotion 会尝试联网下载自带内核，设置面板与渲染日志都会提示 |

### 渲染前依赖校验

缺依赖时**在点渲染时就报错**，而不是等 TTS 全部跑完才抛出误导性的「TTS 合成失败」：

```
未检测到 ffmpeg，无法把配音转成成片需要的音频格式。
请把 ffmpeg.exe 放到下面的目录后重启应用：
<应用安装目录>/resources/bin
```

由 `server/src/services/deps.ts` 的 `checkRenderDeps()` 实现，`/api/health` 也暴露了结果。

---

## 设置面板

`Ctrl/Cmd + ,` 打开，或菜单「设置 → API 与渲染设置」。

| 分组 | 项 |
|---|---|
| LLM 接口 | API Key（必填）、接口地址、模型 |
| 渲染 | Chromium 路径（留空自动探测）、并发导帧数（留空 = CPU 核数一半） |
| 本机环境 | Chromium / ffmpeg 探测结果与路径、输出目录、运行模式 |

- 配置保存在**应用数据目录**的 `config.json`，不写入仓库的 `server/.env`
- 保存后**自动重启后端**，无需手动重启应用
- 首次启动未配置 API Key 会**自动弹出**设置面板

### 图标

唯一来源是 `web/public/favicon.svg`，桌面端的三种格式由 `npm run icon` 自动生成，
`npm run build` 会顺带执行。以后改图标只改那个 SVG 即可。

---

## 常见问题

**`npm install` 提示 electron / ffmpeg 安装脚本被拦截**

`desktop/package.json` 已配 `allowScripts` 放行 `ffmpeg-static` 与 `electron-winstaller`。
仍失败可手动执行：

```bash
cd desktop
node node_modules/electron/install.js
node node_modules/ffmpeg-static/install.js
```

国内可先设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。

**打包时下载 Electron / winCodeSign 很慢**

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist:win
```

**安装包装在 Program Files 会渲染失败**

渲染需要写临时入口文件。默认已改为安装到当前用户目录
（`%LOCALAPPDATA%\Programs`），请勿改到只读目录。

**抓取公众号 / 知乎等 JS 动态页失败**

打包时依赖用 `--ignore-scripts` 重装，跳过了 Playwright 的浏览器下载（约 300MB+），
因此**抓取 JS 动态页的兜底能力不可用**；静态页抓取不受影响。
需要这项能力的话，在 `scripts/stage-server.mjs` 里去掉 `--ignore-scripts`。

**想随包携带 Chromium**

在 `desktop/electron-builder.yml` 的 extraResources 里加回 Remotion 自带的
headless shell（+269MB），适合目标机器可能没有 Chromium 内核的场景。

**改动 `server/package.json` 后打包内容没更新**

依赖是打包时在 `build/resources/payload/server` 用 pnpm 重装的，
需要重新 `npm run stage` 或直接 `npm run dist:win`。

**打包时报 `node_modules` 相关异常**

先单独跑 `npm run stage` 看暂存自检的输出，它会明确指出缺了哪些关键文件。

---

**相关文档**：[部署与开发](DEPLOYMENT.md) · [配置](CONFIGURATION.md) · [TTS 配音](TTS.md) · [架构](ARCHITECTURE.md)
