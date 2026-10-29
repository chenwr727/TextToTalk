/**
 * 语音引擎冒烟测试。
 *
 * 起因：Edge TTS 上游悄悄改了一次鉴权，包里的 `Sec-MS-GEC` 版本号过期后所有请求都变成
 * `Unexpected server response: 403`——而界面上只是"生成失败"，没人知道是引擎挂了还是
 * 网络抖了。这类问题只能靠真的合成一句来发现，所以做成一条能随时跑的命令：
 *
 *   pnpm run tts:smoke            # 所有已启用的引擎各合成一句
 *   pnpm run tts:smoke -- edge    # 只测 edge
 *
 * 退出码：默认引擎失败才算失败（其余引擎失败只提示），因为用户实际用的就是默认引擎。
 */
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_TTS_ENGINE, listEngines, resolveEngine } from "../src/services/tts/index.js";

const TEXT = "这一句是用来验证语音引擎还能不能出声的。";
const only = process.argv[2];
const engines = listEngines().filter((e) => !only || e.id === only);

if (!engines.length) {
  console.error(
    `[tts:smoke] 没有匹配的引擎（可用：${
      listEngines()
        .map((e) => e.id)
        .join(", ") || "无"
    }）`,
  );
  process.exit(1);
}

const dir = mkdtempSync(path.join(tmpdir(), "tts-smoke-"));
const rows: { id: string; ok: boolean; detail: string }[] = [];

for (const e of engines) {
  const engine = resolveEngine(e.id);
  const voice = e.voices[0]?.id;
  const out = path.join(dir, `${e.id}.mp3`);
  if (!engine || !voice) {
    rows.push({ id: e.id, ok: false, detail: engine ? "没有可用音色" : "引擎未加载" });
    continue;
  }
  const t0 = Date.now();
  try {
    await engine.synthToFile(TEXT, out, voice);
    const size = statSync(out).size;
    const ms = Date.now() - t0;
    rows.push({ id: e.id, ok: size > 1024, detail: `${voice} ${(size / 1024).toFixed(0)}KB ${ms}ms` });
  } catch (err) {
    rows.push({ id: e.id, ok: false, detail: (err as Error).message.split("\n")[0].slice(0, 120) });
  }
}

rmSync(dir, { recursive: true, force: true });

console.log(`[tts:smoke] 默认引擎 ${DEFAULT_TTS_ENGINE || "（无）"}`);
for (const r of rows) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.id.padEnd(10)} ${r.detail}`);
}

const defRow = rows.find((r) => r.id === DEFAULT_TTS_ENGINE);
if (defRow && !defRow.ok) {
  console.error(`[tts:smoke] 默认引擎 ${DEFAULT_TTS_ENGINE} 合成失败`);
  process.exit(1);
}
