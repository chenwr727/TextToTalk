import { useEffect, useRef, useState } from "react";
import type { StoryPage } from "../types";
import { subscribeStoryboard, getTask, regeneratePage } from "../api";
import { RenderThumb } from "./RenderThumb";
import { PageEditor } from "./PageEditor";
import { LAYOUT_LABEL, ART_LABEL, ICON_EMOJI, ROLE_LABEL, STAGES } from "./labels";

export function StoryboardPreview({
  taskId,
  pages,
  done,
  tokens,
  stage,
  onPagesChange,
  onDoneChange,
  onTokensChange,
  onStageChange,
  onBack,
  onConfirm,
  focusPage,
  onFocusPageHandled,
  theme,
  width = 1920,
  height = 1080,
}: {
  taskId: string;
  pages: StoryPage[];
  done: boolean;
  tokens: string;
  stage: string;
  theme?: string;
  width?: number;
  height?: number;
  onPagesChange: (p: StoryPage[] | ((prev: StoryPage[]) => StoryPage[])) => void;
  onDoneChange: (d: boolean) => void;
  onTokensChange: (t: string | ((prev: string) => string)) => void;
  onStageChange: (s: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  focusPage: number | null;
  onFocusPageHandled: () => void;
}) {
  const [renGen, setRenGen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [rawOpen, setRawOpen] = useState(false);

  const pageTokensRef = useRef<Map<number, string>>(new Map());
  const activePageRef = useRef<number | null>(null);
  const startTagsRef = useRef<Map<number, string>>(new Map());

  const SECTION_DELIM = "════════";
  const parseSectionPage = (label: string): number | null => {
    const m = /第\s*(\d+)\s*页展开/.exec(label ?? "");
    return m ? Number(m[1]) : null;
  };

  const flushBuffers = () => {
    const map = pageTokensRef.current;
    const starts = startTagsRef.current;
    const orderedPages = [...map.keys()].sort((a, b) => a - b);
    const parts: string[] = [];
    for (const p of orderedPages) {
      const start = starts.get(p);
      const body = map.get(p) ?? "";
      if (start) parts.push(start);
      if (body) parts.push(body.endsWith("\n") ? body : body + "\n");
    }
    const combined = parts.join("");
    onTokensChange(combined);
  };

  const toggleSection = (page: number) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });

  const copyTokens = async () => {
    try {
      await navigator.clipboard.writeText(tokens);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      alert("复制失败：" + (e as Error).message);
    }
  };

  const rawSections = (() => {
    const re = /════════ 第 (\d+) 页展开 ════════\r?\n([\s\S]*?)(?=════════ 第 \d+ 页展开 ════════|$)/g;
    const out: { page: number; content: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(tokens))) out.push({ page: Number(m[1]), content: m[2].replace(/\r\n/g, "\n") });
    return out;
  })();

  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const copySection = async (page: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPage(page);
      setTimeout(() => setCopiedPage((p) => (p === page ? null : p)), 1600);
    } catch (e) {
      alert("复制失败：" + (e as Error).message);
    }
  };

  const onPageSaved = (np: StoryPage) => {
    onPagesChange((prev) => prev.map((p) => (p.pageIndex === np.pageIndex ? np : p)));
    setEditing(null);
  };

  const onRegenerate = async (idx: number) => {
    if (renGen !== null) return;
    setRenGen(idx);
    try {
      const r = await regeneratePage(taskId, idx);
      if (r.ok && r.page) {
        const np = { ...r.page, pageIndex: idx };
        onPagesChange((prev) => prev.map((p) => (p.pageIndex === idx ? np : p)));
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRenGen(null);
    }
  };

  useEffect(() => {
    if (focusPage == null) return;
    const t = setTimeout(() => {
      const el = pageRefs.current[focusPage - 1];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlight(focusPage);
        const clear = setTimeout(() => setHighlight(null), 2600);
        return () => clearTimeout(clear);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [focusPage, pages.length]);

  useEffect(() => {
    if (highlight == null && focusPage != null) onFocusPageHandled();
  }, [highlight, focusPage]);

  useEffect(() => {
    let cancelled = false;
    if (pages.length === 0) {
      getTask(taskId)
        .then((t) => {
          if (cancelled) return;
          if (t.storyboard?.pages?.length) {
            onPagesChange([...t.storyboard!.pages]);
            onDoneChange(true);
          }
        })
        .catch(() => {});
    }
    const map = pageTokensRef.current;
    const starts = startTagsRef.current;
    map.clear();
    starts.clear();
    activePageRef.current = null;
    onTokensChange("");
    const unsub = subscribeStoryboard(
      taskId,
      (p) => onPagesChange((prev) => prev.some((x) => x.pageIndex === p.pageIndex) ? prev : [...prev, p]),
      () => onDoneChange(true),
      () => {},
      (tok) => {
        const ap = activePageRef.current;
        if (ap == null) return;
        map.set(ap, (map.get(ap) ?? "") + tok);
        flushBuffers();
      },
      (s) => onStageChange(s),
      (sb) => {
        const s = sb as { pages?: StoryPage[] };
        if (s?.pages?.length) onPagesChange([...s.pages]);
      },
      (label) => {
        const p = parseSectionPage(label);
        if (p != null) {
          const tag = `${SECTION_DELIM} ${label} ${SECTION_DELIM}\n`;
          starts.set(p, tag);
          if (!(map.has(p))) map.set(p, "");
          activePageRef.current = p;
        }
        flushBuffers();
      },
      () => {
        const ap = activePageRef.current;
        if (ap != null) {
          map.set(ap, "");
          flushBuffers();
        }
      }
    );
    return () => { cancelled = true; unsub(); };
  }, [taskId]);

  const totalSec = pages.reduce((a, p) => a + (p.durationSec || 0), 0);

  return (
    <div className="dsh-sb">
      <div className="dsh-card dsh-sb-head" style={{ padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div className="dsh-outline-title">
            分镜预览
            {done && <span className="dsh-badge dsh-badge-green">全部生成 · {pages.length} 页</span>}
            {!done && <span className="dsh-badge-loading">AI 正在生成…</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "#8a99b0", marginTop: 2 }}>
            {done ? (
              <>全片预计约 <b style={{ color: "#5a6b82" }}>{Math.max(1, Math.round(totalSec))} 秒</b> · 逐页可随时重生成，随时可以继续</>
            ) : (
              "逐页预览实时更新中"
            )}
          </div>
        </div>
        <button onClick={onBack} className="dsh-ghost">← 返回</button>
      </div>

      {!done && (
        <div className="dsh-card" style={{ padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ color: "#8a99b0", fontSize: 12.5 }}>AI 生成流水线</span>
            {STAGES.filter((x) => x.id !== "plan").map((s, i) => {
              const on = s.id === stage;
              const past = i < STAGES.findIndex((x) => x.id === stage) - 1;
              return (
                <span
                  key={s.id}
                  className={"dsh-sb-stage " + (on ? "dsh-sb-stage-on" : past ? "dsh-sb-stage-past" : "dsh-sb-stage-future")}
                  style={on ? { background: s.color } : undefined}
                >{s.label}{on ? " •" : ""}</span>
              );
            })}
          </div>
          <div className="dsh-progress">
            <div className="dsh-progress-bar" />
          </div>
        </div>
      )}

      {tokens && (
        <div className="dsh-card dsh-pipeline">
          <div className="dsh-pipeline-row">
            <span className="dsh-pipeline-label">AI 生成流水线</span>
            {done ? (
              <span className="dsh-done">已完成</span>
            ) : (
              STAGES.filter((x) => x.id === "expand").map((s) => {
                const on = s.id === stage;
                return (
                  <span
                    key={s.id}
                    className={"dsh-stage " + (on ? "dsh-stage-on" : "dsh-stage-off")}
                  >{s.label}{on ? " •" : ""}</span>
                );
              })
            )}
          </div>

          {rawSections.length > 0 ? (
            rawSections.map((sec) => (
              <details
                key={sec.page}
                className="dsh-raw"
                data-open={openSections.has(sec.page)}
                open={false}
                onToggle={() => toggleSection(sec.page)}
              >
                <summary>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="dsh-raw-caret">▶</span>
                    第 {sec.page} 页 AI 返回内容（{sec.content.length} 字符）
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); copySection(sec.page, sec.content); }}
                    className={"dsh-raw-copy" + (copiedPage === sec.page ? " copied" : "")}
                  >
                    {copiedPage === sec.page ? "已复制 ✓" : "复制"}
                  </button>
                </summary>
                <pre>{sec.content}</pre>
              </details>
            ))
          ) : (
            <details
              className="dsh-raw"
              data-open={rawOpen}
              open={false}
              onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="dsh-raw-caret">▶</span>
                  查看 AI 原始输出（{tokens.length} 字符）
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyTokens(); }}
                  className={"dsh-raw-copy" + (copied ? " copied" : "")}
                >
                  {copied ? "已复制 ✓" : "复制"}
                </button>
              </summary>
              <pre>{tokens}</pre>
            </details>
          )}
        </div>
      )}

      {pages.length === 0 && <p className="dsh-sb-empty">等待生成…</p>}
      <div className="dsh-sb-list">
        {pages.map((p, i) => (
          <div
            key={p.pageIndex}
            ref={(el) => { pageRefs.current[i] = el; }}
            className={"dsh-card dsh-sb-page" + (highlight === i + 1 ? " highlight" : "")}
          >
            <div className="dsh-sb-head">
              <span className="dsh-page-num">P{i + 1}</span>
              <b className="dsh-sb-title">{p.title}</b>
              <span style={{ color: "#8a99b0", fontSize: 12.5 }}>≈{p.durationSec}s</span>
              <div className="dsh-sb-actions">
                {p.icon ? <span className="dsh-sb-tag" title="图标">{ICON_EMOJI[p.icon] ?? "•"}</span> : null}
                {(p.art ?? p.layout) ? (
                  <span className="dsh-sb-tag dsh-sb-tag-blue">
                    {p.art ? (ART_LABEL[p.art] ?? "") : p.layout ? (LAYOUT_LABEL[p.layout] ?? "") : ""}
                  </span>
                ) : null}
                {p.role ? <span className="dsh-sb-tag dsh-sb-tag-role">{ROLE_LABEL[p.role] ?? p.role}</span> : null}
                <button
                  onClick={() => setEditing(editing === p.pageIndex ? null : p.pageIndex)}
                  disabled={renGen !== null}
                  title="编辑这一页"
                  className="dsh-ghost"
                >
                  {editing === p.pageIndex ? "✕ 收起" : "✏️ 编辑"}
                </button>
                <button
                  onClick={() => onRegenerate(p.pageIndex)}
                  disabled={renGen !== null}
                  title="重新生成这一页"
                  className="dsh-ghost"
                >
                  {renGen === p.pageIndex ? "⏳ 重生成中…" : "🔄 重生成"}
                </button>
              </div>
            </div>

            <div className="dsh-sb-canvas">
              {renGen === p.pageIndex && (
                <div className="dsh-sb-overlay">
                  <div className="dsh-spinner" style={{ width: 36, height: 36, borderWidth: 4 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2f6df6" }}>本页重新生成中…</span>
                </div>
              )}
              <RenderThumb p={p} isFirst={i === 0} theme={theme} width={width} height={height} />
              <div className="dsh-sb-caption">
                <div className="dsh-sb-caption-label">字幕 CAPTION</div>
                <div className="dsh-sb-caption-text">{p.captions.join("｜")}</div>
              </div>
            </div>

            {editing === p.pageIndex && (
              <PageEditor
                taskId={taskId}
                page={p}
                onSave={onPageSaved}
                onCancel={() => setEditing(null)}
                onRegenerating={(b) => setRenGen(b ? p.pageIndex : null)}
              />
            )}
          </div>
        ))}
      </div>

      <button onClick={onConfirm} disabled={!done || renGen !== null || editing !== null} className="dsh-btn dsh-sb-confirm">
        {!done
          ? "正在生成分镜，请稍候…"
          : renGen !== null
            ? "正在生成中，请稍候…"
            : editing !== null
              ? "请先保存或取消当前编辑"
              : "确认分镜，进入渲染 →"}
      </button>
    </div>
  );
}