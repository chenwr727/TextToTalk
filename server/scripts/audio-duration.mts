/**
 * \u7528**\u771f\u5b9e\u97f3\u9891\u6587\u4ef6**\u6838\u5bf9\u5b57\u5e55\u58f0\u660e\u65f6\u957f\u3002
 *
 * gallery \u91cc\u7684\u6837\u672c\u6ca1\u6709\u771f\u5b9e\u97f3\u9891\uff08\u53ea\u6709\u6570\u636e\uff09\uff0c\u6240\u4ee5\u8fd9\u6761\u5224\u636e\u65e0\u6cd5\u5728\u90a3\u91cc\u9a8c\u8bc1\u3002
 * \u7528\u6cd5\uff1anode --import tsx scripts\\audio-duration.mts e2e-1793254996507
 *
 * \u5b9e\u6d4b\u4e24\u4efd\u771f\u5b9e e2e \u4ea7\u7269\uff08\u5404 16 \u53e5\uff09\uff1a\u58f0\u660e\u65f6\u957f\u4e0e\u771f\u5b9e\u97f3\u9891**\u5b8c\u5168\u4e00\u81f4**\uff080.00s\uff09\u3002
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  auditAudioDuration,
  auditSentenceCoverage,
  auditNarrationMatchesCaptions,
  expectedFrames,
} from "../src/services/elementAudit.js";

/**
 * \u8bfb RIFF chunk \u5f97\u771f\u5b9e\u65f6\u957f\u3002
 *
 * **\u4e0d\u80fd\u7528\u56fa\u5b9a\u504f\u79fb**\uff08byteRate@28\u3001dataSize@40\uff09\uff1a\u5b9e\u9645\u6587\u4ef6\u5728 fmt \u4e0e data \u4e4b\u95f4
 * \u8fd8\u6709\u4e00\u4e2a LIST chunk\uff0c\u504f\u79fb\u9519\u4f4d\u4f1a\u8bfb\u51fa\u201c\u97f3\u9891\u6bd4\u58f0\u660e\u77ed 3.7 \u79d2\u201d\u8fd9\u79cd\u5b8c\u5168\u865a\u5047\u7684\u7ed3\u8bba\u3002
 */
function wavDuration(file: string): number | null {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF") return null;
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = b.readUInt32LE(off + 16);
    if (id === "data") return byteRate ? sz / byteRate : null;
    off += 8 + sz + (sz % 2);
  }
  return null;
}

const task = process.argv[2];
if (!task) {
  console.error("\u7528\u6cd5\uff1anode --import tsx scripts\\audio-duration.mts <taskId>");
  process.exit(2);
}
const pagesJson = `out/${task}.mp4.pages.json`;
if (!existsSync(pagesJson)) {
  console.error(`\u627e\u4e0d\u5230 ${pagesJson}\uff08\u5148\u8dd1\u4e00\u6b21 e2e \u751f\u6210\u5b83\uff09`);
  process.exit(2);
}
const pages = Object.values(JSON.parse(readFileSync(pagesJson, "utf8"))) as {
  pageIndex?: number;
  narration?: string;
  captions?: string[];
  sentences?: { text: string; seconds: number; audioUrl?: string }[];
}[];

const rows: { text: string; declared: number; real: number | null }[] = [];
for (const p of pages) {
  for (const s of p.sentences ?? []) {
    if (!s.audioUrl) continue;
    const f = `assets/tts/${task}/audio/${s.audioUrl.split("/").pop()}`;
    rows.push({ text: s.text, declared: s.seconds, real: existsSync(f) ? wavDuration(f) : null });
  }
}
const missing = rows.filter((r) => r.real == null).length;
console.log(
  `${rows.length} \u53e5\u5b57\u5e55\uff0c\u62ff\u5230\u771f\u5b9e\u97f3\u9891 ${rows.length - missing} \u53e5${missing ? `\uff08${missing} \u53e5\u7f3a\u97f3\u9891\uff09` : ""}`,
);
/* 字幕数 vs 配音句数：TTS 部分失败只 warn，那句就没声音也不显示字幕 */
const coverage = pages.flatMap((p) =>
  auditSentenceCoverage(p.captions?.length ?? 0, p.sentences?.length ?? 0).map((f) => ({
    ...f,
    message: `第 ${(p.pageIndex ?? 0) + 1} 页：${f.message}`,
  })),
);
/* 口播稿 vs 字幕：分歧就是“听到一套、看到另一套” */
const narrationChecks = pages.flatMap((p) =>
  auditNarrationMatchesCaptions(p.narration ?? "", p.captions ?? []).map((f) => ({
    ...f,
    message: `第 ${(p.pageIndex ?? 0) + 1} 页：${f.message}`,
  })),
);

/*
 * 成片帧数核对：成片 = 页帧数之和 − 转场重叠。
 *
 * 页帧数与转场重叠均取自渲染端真实算法（DynamicVideo 第 49-54 行、
 * TransitionSeries 用**下一页**的 transition 长度重叠）。
 * 实测 e2e-1793254996507：页和 1953 帧、转场 54 帧（slide-left14+zoom16+fade12+fade12）
 * → 预期 1899，成片实测 1900，差 1 帧属舍入。
 * 若差异超过 2 帧，说明**字幕/语音时长与最终视频对不上**：声音和画面会越走越错。
 */

const fpsArg = Number(process.argv[3] || 30);
const mp4Path = `out/${task}.mp4`;
if (existsSync(mp4Path)) {
  const probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,nb_frames",
      "-select_streams",
      "v:0",
      "-of",
      "json",
      mp4Path,
    ]).toString(),
  ) as { streams?: { nb_frames?: string }[] };
  const real = Number(probe.streams?.[0]?.nb_frames ?? NaN);
  const want = expectedFrames(pages, fpsArg);
  if (Number.isFinite(real) && Math.abs(real - want) <= 2) {
    console.log(`✓ 成片帧数对得上：${real} 帧（分镜算出 ${want}）`);
  } else {
    console.log(
      `✗ 成片帧数与分镜对不上：实测 ${real} 帧、分镜算出 ${want} 帧` +
        `（差 ${real - want} 帧 ≈ ${((real - want) / fpsArg).toFixed(2)}s）——声音和画面会越走越错`,
    );
  }
} else {
  console.log(`（没有 ${mp4Path}，跳过成片帧数核对）`);
}

const findings = [...coverage, ...narrationChecks, ...auditAudioDuration(rows)];
if (findings.length === 0) {
  console.log(
    "\u2713 \u58f0\u660e\u65f6\u957f\u4e0e\u771f\u5b9e\u97f3\u9891\u4e00\u81f4\uff08\u5bb9\u5dee 0.15s\uff09",
  );
} else {
  for (const f of findings) console.log(`\u2717 ${f.message}`);
  process.exit(1);
}
