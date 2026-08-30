# API

- [鉴权](#鉴权)
- [接口列表](#接口列表)
- [SSE 事件](#sse-事件)

---

## 鉴权

任务类接口需携带创建时返回的 `token`，放在 `?token=` 查询参数或
`Authorization: Bearer <token>` 头里，不匹配返回 401。

前端封装见 `web/src/api.ts`。

---

## 接口列表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查。返回 `outDir`、`assetsDir`、`publicBaseUrl`、`deps`（依赖探测结果）、`llm`（接口地址 / 模型 / 是否已配置 Key） |
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

---

## SSE 事件

`/api/outline` 与 `/api/stream` 均返回 `text/event-stream`。

| 事件 | 说明 |
|---|---|
| `meta` | 任务元信息（taskId、token） |
| `token` | LLM 流式产出的文本片段 |
| `stage` | 阶段切换（大纲 / 分镜 / 渲染） |
| `section` | 单页大纲完成 |
| `final` | 全部完成 |

反向代理部署时需要对这两个接口**关闭响应缓冲**（nginx 设 `proxy_buffering off`），
否则前端会等到响应结束才一次性收到，失去流式效果。

---

**相关文档**：[部署与开发](DEPLOYMENT.md) · [架构](ARCHITECTURE.md) · [配置](CONFIGURATION.md)
