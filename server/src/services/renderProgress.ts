import { appendFileSync } from "node:fs";

/**
 * Remotion 子进程的 stdout/stderr 通常一次吐出好几行，甚至把多行拼在同一个 chunk 里，
 * 所以进度必须从「整段文本」里挑出最后一个 match，而不是逐行匹配。
 */
const PROGRESS_RE =
  /(?:Rendering|Rendered|Stitching|Encod(?:ed|ing))\s+(?:still|stills|frames?)?\s*[^\d]*?(\d+)\s*\/\s*(\d+)/gi;

/** 渲染进度区间：前置的 TTS / BGM 阶段占 0~0.12，最后 0.86 留给逐帧渲染 */
export const RENDER_PROGRESS_BASE = 0.12;
export const RENDER_PROGRESS_SPAN = 0.86;
export const RENDER_PROGRESS_CAP = 0.98;

/** 环形缓冲保留的日志行数（用于失败时回抛给前端的尾部日志） */
export const RENDER_LOG_MAX_LINES = 200;

/**
 * 从一段 Remotion 输出里解析渲染进度。
 * @returns 0.12~0.98 之间的进度；该段文本里没有进度信息时返回 null。
 */
export function parseRenderProgress(
  text: string,
  base = RENDER_PROGRESS_BASE,
  span = RENDER_PROGRESS_SPAN,
): number | null {
  let last: number | null = null;
  PROGRESS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROGRESS_RE.exec(text)) !== null) {
    const done = Number(m[1]);
    const total = Number(m[2]);
    if (total > 0) last = Math.min(RENDER_PROGRESS_CAP, base + (done / total) * span);
  }
  return last;
}

export type RenderLogKind = "out" | "err" | "fatal" | (string & {});

export interface RenderLoggerOptions {
  /** 完整日志落盘路径 */
  logFile: string;
  /** 环形缓冲保留行数，默认 RENDER_LOG_MAX_LINES */
  maxLines?: number;
  /** 解析到进度时回调 */
  onProgress?: (p: number) => void;
  /** stderr 每一行的回调（调用方决定要不要打到控制台） */
  onStderrLine?: (line: string) => void;
}

export interface RenderLogger {
  /** 追加一行日志：加 "[kind] " 前缀 → 环形缓冲 → 落盘 */
  append(kind: RenderLogKind, line: string): void;
  stdout(chunk: Buffer | string): void;
  stderr(chunk: Buffer | string): void;
  /** 取环形缓冲里最后 n 行（失败时回抛给前端） */
  tail(n: number): string;
}

/**
 * 渲染子进程的日志/进度管道。
 * 抽成独立模块的原因：这段逻辑和「渲染业务」无关，且 parseRenderProgress / tail 都是可单测的纯行为。
 */
export function createRenderLogger(opts: RenderLoggerOptions): RenderLogger {
  const maxLines = opts.maxLines ?? RENDER_LOG_MAX_LINES;
  const lines: string[] = [];

  const append = (kind: RenderLogKind, line: string): void => {
    const clean = line.trim();
    if (!clean) return;
    const text = `[${kind}] ${clean}`;
    lines.push(text);
    if (lines.length > maxLines) lines.splice(0, lines.length - maxLines);
    try {
      appendFileSync(opts.logFile, text + "\n");
    } catch {
      // 日志落盘失败不应中断渲染
    }
  };

  return {
    append,
    stdout(chunk) {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) append("out", line);
      if (!opts.onProgress) return;
      const p = parseRenderProgress(text);
      if (p !== null) opts.onProgress(p);
    },
    stderr(chunk) {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        append("err", line);
        opts.onStderrLine?.(line.trim());
      }
    },
    tail(n) {
      return lines.slice(-n).join("\n");
    },
  };
}
