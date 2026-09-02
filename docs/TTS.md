# TTS 配音

- [支持的模型](#支持的模型)
- [配置方式](#配置方式)
- [引擎与音色配置](#引擎与音色配置)
- [语速与音量](#语速与音量)
- [架构与扩展](#架构与扩展)
- [常见问题](#常见问题)

---

## 支持的模型

| 引擎 ID | 名称 | 密钥 | 说明 |
|---|---|---|---|
| `edge` | Edge 在线语音 | 免密钥 | 微软 Edge 在线合成，开箱即用 |
| `dashscope` | 阿里云百炼 CosyVoice | 需 `DASHSCOPE_*` | 支持方言、声音复刻 |
| `qwen-audio` | 阿里云百炼 Qwen-Audio-TTS | 需 `DASHSCOPE_*` | 支持情感标签、多语言 |
| `seedtts` | 火山引擎 Seed-TTS | 需 `SEED_TTS_*` | 豆包语音合成大模型 2.0，HTTP Chunked 单向流式 |

> `dashscope` 与 `qwen-audio` 共用阿里云百炼的密钥与工作空间。
> 未配置 `DASHSCOPE_*` 时，这两个引擎会自动隐藏，仅保留 Edge。
> 未配置 `SEED_TTS_API_KEY` 时，Seed-TTS 引擎同样自动隐藏。

---

## 配置方式

### Web / Docker / 本地开发

复制 `server/.env.example` 为 `server/.env`，填入所需密钥：

```bash
# 使用阿里云百炼引擎时（dashscope / qwen-audio）：
DASHSCOPE_API_KEY=sk-your-dashscope-key
DASHSCOPE_WORKSPACE_ID=your-workspace-id
# DASHSCOPE_REGION=cn-beijing   # 可选，工作空间地域，默认 cn-beijing

# 使用火山引擎 Seed-TTS 时：
SEED_TTS_API_KEY=your-volcengine-api-key
# SEED_TTS_RESOURCE_ID=seed-tts-2.0   # 可选，大模型音色用 seed-tts-2.0（默认），复刻音色用 seed-icl-2.0
```

### 桌面版

桌面版**不读取 `server/.env`**，通过设置面板（`Ctrl/Cmd + ,`）配置：

1. 打开设置面板 → 「TTS 配音」分组。
2. 填入 DashScope API Key 与 Workspace ID。
3. 保存后自动重启后端生效。

> 设置面板的「TTS 配音」分组是**动态生成**的：根据 `tts.config.json` 里各引擎声明的 `requiresEnv` 自动渲染输入框。以后新增引擎，设置面板会自动出现对应配置项。

**自定义引擎/音色**：桌面端首次启动会把内置 `tts.config.json` 复制到**用户数据目录**，后端实际读取这份用户配置。直接编辑该文件即可自定义音色/模型，升级不会被覆盖。用户数据目录位置见设置面板「本机环境」的"数据目录"。

---

## 引擎与音色

引擎与音色全部由配置文件 `server/tts.config.json` 驱动，**加模型/音色只改配置，不改代码**。

```jsonc
{
  "defaultEngine": "edge",          // 默认引擎
  "engines": [
    {
      "id": "edge",                 // 引擎唯一标识
      "name": "Edge 在线语音",       // 显示名
      "enabled": true,              // 是否启用
      "voices": [                   // 音色列表
        { "id": "zh-CN-XiaoxiaoNeural", "label": "👩 晓晓（女声）" }
      ]
    },
    {
      "id": "dashscope",
      "name": "阿里云百炼 CosyVoice",
      "type": "dashscope",          // 引擎实现类型（对应工厂函数）
      "model": "cosyvoice-v3-flash",// 模型名
      "sampleRate": 24000,
      "format": "wav",
      "requiresEnv": [              // 所需环境变量（缺失则引擎不加载）
        { "name": "DASHSCOPE_API_KEY", "label": "DashScope API Key", "secret": true }
      ],
      "voices": [ ... ]
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `id` | 引擎唯一标识，前端下拉框的 value |
| `name` | 引擎显示名 |
| `enabled` | `false` 时禁用该引擎 |
| `type` | 引擎实现类型，缺省等于 `id`；多个引擎可复用同一实现（如 dashscope / qwen-audio 都用 `dashscope`） |
| `model` / `sampleRate` / `format` | 传给引擎的模型参数 |
| `requiresEnv` | 该引擎运行所需的环境变量，缺失时引擎不加载；`secret: true` 的设置面板用密码框 |
| `voices` | 音色列表，`id` 传给引擎，`label` 前端展示 |

### 音色列表

- **Edge**：晓晓、云希、云扬、晓伊、晓北（5 个中文音色）。
- **CosyVoice**：龙阳、龙小夏、龙小春、龙小玉、龙山歌、龙安欢（6 个）。
- **Qwen-Audio-TTS**：龙安风悦、龙安元妃、龙安灵希、龙安小昕、龙安欢、龙杰力豆、龙泡泡、龙火火、龙川叔、Loong Mary、Loong Eva、Loong John（12 个，含英音）。
- **Seed-TTS**：vivi 2.0、小何、云舟、小天、Tim（通用）+ 知性灿灿、可爱女生、调皮公主、爽朗少年、天才同桌（角色扮演），共 10 个。

---

## 语速与音量

前端「🎙️ 配音设置」面板可调：

| 参数 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 语速 | 0.5× ~ 2× | 1× | 配音语速倍率 |
| 音量 | 0% ~ 200% | 100% | 配音音量倍率 |

各引擎实现：

- **Edge**：用 SSML `<prosody rate volume>` 包裹文本；默认值（1×/100%）时返回纯文本，行为不变。
- **DashScope**（CosyVoice / Qwen-Audio）：`input` 加 `speed`（0.5~2.0）与 `volume`（前端倍率 ×50 转成 0~100，默认 1× 对应 50）。
- **Seed-TTS**：`req_params.audio_params.speech_rate = (语速倍率 − 1) × 100`（整数，如 1.5× → 50）；音量暂不支持。

---

## 架构

```
前端选引擎/音色/语速/音量
  → task.params（engine / voice / ttsSpeed / ttsVolume）
  → renderService → ttsService.generateTts
    → 按引擎注册表解析引擎实例
    → 逐句并发合成（3 worker + 3 次重试）
    → 统一转 WAV、测时长、容错
  → TtsResult（每句音频 + 时长）
  → Remotion 按语音节奏排音频 + 字幕
```

### 代码结构

```
server/src/services/tts/
  types.ts       # TtsEngine 接口、TtsEnvField、TtsSynthOptions
  index.ts       # 从 tts.config.json 加载引擎注册表、listEngines、listEnvFields
  edge.ts        # Edge 引擎工厂
  dashscope.ts   # DashScope 引擎工厂（CosyVoice / Qwen-Audio 复用）
  seedtts.ts     # 火山引擎 Seed-TTS 工厂（HTTP Chunked NDJSON 流式解析）
```

### 扩展新引擎

1. 在 `server/src/services/tts/` 下新建一个工厂函数文件，实现 `TtsEngine` 接口。
2. 在 `index.ts` 的 `factories` 注册一行：`{ type: factory }`。
3. 在 `tts.config.json` 加一个引擎条目（含 `requiresEnv`、`voices`）。

> 桌面端设置面板、后端环境变量注入、前端下拉框都会**自动适配**，无需改其他代码。

---

## 常见问题

**Q：为什么前端只显示 Edge，看不到 CosyVoice / Qwen-Audio / Seed-TTS？**
A：未配置对应密钥（`DASHSCOPE_API_KEY` / `DASHSCOPE_WORKSPACE_ID` / `SEED_TTS_API_KEY`），引擎被 `requiresEnv` 校验跳过。配置后重启即可。

**Q：桌面端打包后能改 `tts.config.json` 吗？**
A：**可以**。桌面端首次启动会把内置配置复制到**用户数据目录**（`tts.config.json`），后端实际读取这份用户配置。直接编辑该文件即可自定义音色/模型，升级不会被覆盖。普通用户无需改，在设置面板填 key 即可。

**Q：语速/音量对 Edge 生效吗？**
A：生效。Edge 通过 SSML 的 `<prosody>` 实现；默认值下走纯文本，不影响原有行为。

---

**相关文档**：[配置](CONFIGURATION.md) · [桌面版](DESKTOP.md) · [架构](ARCHITECTURE.md)