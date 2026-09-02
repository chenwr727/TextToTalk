# 配置

- [配置文件](#配置文件)
- [LLM（必填）](#llm必填)
- [渲染（可选）](#渲染可选)
- [桌面版配置](#桌面版配置)
- [渲染加速](#渲染加速)

---

## 配置文件

复制 `server/.env.example` 为 `server/.env`，`tsx` 会自动加载。

| 运行方式 | 配置来源 |
|---|---|
| Docker / 本地开发 | `server/.env` |
| 桌面版 | 应用数据目录的 `config.json`（设置面板），[见下](#桌面版配置) |

环境变量 `TTT_ENV_FILE` 可覆盖 `.env` 路径，桌面版用它指向 userData 下的配置。

---

## LLM（必填）

| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | **必填**，OpenAI 兼容接口的 Key |
| `LLM_API_URL` | **必填完整 endpoint 路径**，如 `https://api.deepseek.com/v1/chat/completions`；智谱填 `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions` |
| `LLM_MODEL` | 模型名，默认 `deepseek-v4-flash` |
| `LLM_ENABLE_THINKING` | 是否保留模型的 thinking 内容，默认 `false` |

---

## 渲染（可选）

| 变量 | 默认 | 说明 |
|---|---|---|
| `RENDER_CONCURRENCY` | CPU 核数一半 | 并发导帧数。多核可设为核数；`=1` 最稳（低内存 / 受限容器） |
| `RENDER_SCALE` | 不设置 | `<1` 降分辨率以提速，适合草稿预览；终版不要设 |
| `RENDER_GL` | `swiftshader` | 本机有独显时设 `angle` 走 WebGL 硬件加速 |
| `RENDER_HW_ACCEL` | `0` | 硬件编解码开关 |
| `RENDER_MAX_TASKS` | `1` | 渲染队列并发上限 |
| `RENDER_X264_PRESET` | `veryfast` | x264 编码预设 |
| `CHROME_PATH` | 自动探测 | 指定 Chromium 可执行文件；未设置时服务端自动探测系统 Edge / Chrome（Docker 内已指向 `/usr/bin/chromium`） |

---

## 桌面版配置

桌面版**不读取仓库的 `server/.env`**，因为安装目录可能只读。
配置存在应用数据目录的 `config.json`，通过设置面板（`Ctrl/Cmd + ,`）修改。

面板可配项与上面的环境变量一一对应（LLM 三项 + `CHROME_PATH` + `RENDER_CONCURRENCY`），
保存后**自动重启后端**生效。

以下几项由桌面端自动注入，不需要手动配置：

| 变量 | 来源 |
|---|---|
| `PORT` / `HOST` | 启动时探测的空闲端口，固定 `127.0.0.1` |
| `TTT_PUBLIC_BASE_URL` | 同上，供 Remotion 回拉音频 |
| `TTT_OUT_DIR` / `TTT_ASSETS_DIR` | 应用数据目录下的 `data/out`、`data/assets` |
| `TTT_WEB_DIR` | 前端构建产物目录，存在时由后端托管 |
| `TTT_BIN_DIR` | 内置 ffmpeg 所在目录（`resources/bin`） |
| `TTT_CHROME_AVAILABLE` | Chromium 探测结果，供渲染前校验使用 |

---

## 渲染加速

渲染是逐帧完整 Chromium 截图，耗时 ≈ **分辨率 × 帧数**。按收益排序：

1. **多核并发**（首选，默认已开）—— 把 `RENDER_CONCURRENCY` 设为核数（如 8）；
   内存紧张或受限容器设 `=1`。
2. **GPU 硬件加速** —— 有独显时设 `RENDER_GL=angle`，
   从软件 `swiftshader` 切到 WebGL，提速明显。
3. **降分辨率跑草稿** —— 设 `RENDER_SCALE=0.75`（约 1440×810）校对效果，
   确认后去掉再出终版。
4. **降低帧率** —— `fps` 从 30 降到 24 / 15，帧数近乎线性下降，
   PPT 讲解类完全可接受。

> 以上变量改完无需重启前端，`tsx watch` 已热载后端。
> 桌面版需通过设置面板修改，保存后会自动重启后端。

---

**相关文档**：[部署与开发](DEPLOYMENT.md) · [桌面版](DESKTOP.md) · [TTS 配音](TTS.md) · [架构](ARCHITECTURE.md)
