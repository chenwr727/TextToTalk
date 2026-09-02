# 部署与开发

三种运行方式，按使用场景选：

| 方式 | 适用 | 入口 |
|---|---|---|
| [Docker](#docker一键起) | 想立刻跑起来、不关心内部细节 | 一条命令 |
| [本地开发](#本地开发) | 改代码、调试 | 三个终端 |
| [桌面版](DESKTOP.md) | 当普通软件用、给非技术同事 | 双击 exe |

---

## 环境要求

| 项 | 要求 |
|---|---|
| Node | **20.19+ / 22.12+**（推荐 22 或 24，Docker 镜像为 `node:24-alpine`） |
| pnpm | 9+ |
| ffmpeg + ffprobe | TTS 转码与抽帧依赖（桌面版已内置） |
| Playwright 内核 | 仅「抓 JS 动态页」时需要 |

> 桌面版的 ffmpeg 已随包内置，无需本机预装，详见 [桌面版 · 依赖处理](DESKTOP.md#依赖处理)。

---

## Docker 一键起

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

</details>

### 容器结构

- **单容器**：nginx 监听 80 反代 `/api`，后端监听 4000
- **端口**默认 `8080:80`，改 `docker-compose.yml` 的 `ports` 即可
- **数据持久化**：成片、音频、TTS 缓存以 bind mount 挂载到宿主机
  （`./server/out`、`./server/assets`、`./server/tts`），重建容器不丢
- **国内源**：镜像已配 npm（npmmirror）与 Alpine（清华 TUNA）源，
  Playwright 内核走 npmmirror 镜像
- **镜像内置**：nginx + Node 后端 + Chromium + 中文字体 + ffmpeg + Playwright 内核

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

> pnpm v10+ 默认拦截依赖的安装脚本，`pnpm approve-builds` 用于放行
> esbuild、msedge-tts 等需要 postinstall 的包。不执行会导致渲染 / 配音失败。

### Playwright 内核

仅抓取 JS 动态渲染页（公众号、知乎等）时需要：

```bash
npx playwright install chromium
```

静态页走内置 fetch，不依赖它。

### 首次渲染

首次渲染较慢（Remotion 逐帧导出），几十秒到一分钟；想提速见[渲染加速](CONFIGURATION.md#渲染加速)。

---

## 生产部署注意事项

当前架构的状态存储是**内存态**，因此：

- 任务状态 TTL 24 小时，**重启进程会丢失**
- 适合单机 / 小团队自用，**非多实例生产架构**——多副本下任务查询会命中不到其他实例
- 需要持久化的话见 [Roadmap](../README.md#roadmap) 中的 SQLite 计划

反向代理时注意：

- SSE 接口（`/api/stream`、`/api/outline`）需要**关闭响应缓冲**，
  nginx 需 `proxy_buffering off`
- 成片在线播放依赖 **HTTP Range**，代理层要放行 `Range` 请求头

---

**相关文档**：[桌面版](DESKTOP.md) · [配置](CONFIGURATION.md) · [TTS 配音](TTS.md) · [架构](ARCHITECTURE.md)
