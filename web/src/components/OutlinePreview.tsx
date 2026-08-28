import { useEffect, useState } from "react";
import type { Outline, OutlineBlock } from "../api";
import { LAYOUT_LABEL, ART_LABEL, ROLE_LABEL, ICON_EMOJI, STAGES } from "./labels";

export function OutlinePreview({
  outline,
  generating,
  tokens,
  stage,
  onConfirm,
  onRegenerate,
  onBack,
}: {
  outline: Outline;
  generating: boolean;
  tokens: string;
  stage: string;
  onConfirm: (outline: Outline) => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Outline>(() => ({
    projectTitle: outline.projectTitle ?? "",
    arc: outline.arc ?? "",
    pages: (outline.pages ?? []).map((p) => ({ ...p })),
  }));
  const [copied, setCopied] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const copyTokens = async () => {
    try {
      await navigator.clipboard.writeText(tokens);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      alert("复制失败：" + (e as Error).message);
    }
  };

  const pages = draft.pages ?? [];

  const outlinePageCount = (outline.pages ?? []).length;
  useEffect(() => {
    if (outlinePageCount > 0 && outlinePageCount !== (draft.pages ?? []).length) {
      setDraft({
        projectTitle: outline.projectTitle ?? "",
        arc: outline.arc ?? "",
        pages: (outline.pages ?? []).map((p) => ({ ...p })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlinePageCount]);

  const setPage = (i: number, patch: Partial<OutlineBlock>) => {
    setDraft((d) => ({ ...d, pages: (d.pages ?? []).map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  };
  const addPage = (i?: number) => {
    const at = i === undefined ? pages.length : i + 1;
    setDraft((d) => {
      const np = [...(d.pages ?? [])];
      np.splice(at, 0, { idea: "", layout: "points", role: "build" });
      return { ...d, pages: np };
    });
  };
  const removePage = (i: number) => {
    setDraft((d) => ({ ...d, pages: (d.pages ?? []).filter((_, idx) => idx !== i) }));
  };
  const movePage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    setDraft((d) => {
      const np = [...(d.pages ?? [])];
      [np[i], np[j]] = [np[j], np[i]];
      return { ...d, pages: np };
    });
  };

  const LAYOUTS = Object.keys(LAYOUT_LABEL);
  const ARTS = Object.keys(ART_LABEL);
  const ROLES = Object.keys(ROLE_LABEL);
  const ICONS = Object.keys(ICON_EMOJI);

  return (
    <div className="dsh-outline">
      <div className="dsh-card dsh-outline-head">
        <button onClick={onBack} className="dsh-ghost">← 返回</button>
        <div style={{ flex: 1 }}>
          <div className="dsh-outline-title">
            大纲预览
            {generating
              ? <span className="dsh-badge-loading">AI 正在生成…</span>
              : <span className="dsh-badge dsh-badge-green">{pages.length} 页</span>}
          </div>
          <div className="dsh-outline-sub">
            {generating
              ? "AI 正在规划大纲，实时回流中"
              : "可直接编辑每页内容与顺序，确认后 AI 将基于此逐页展开生成分镜"}
          </div>
        </div>
      </div>

      {tokens && (
        <div className="dsh-card dsh-pipeline">
          <div className="dsh-pipeline-row">
            <span className="dsh-pipeline-label">AI 生成流水线</span>
            {generating ? (
              STAGES.filter((x) => x.id === "plan").map((s) => {
                const on = s.id === stage;
                return (
                  <span
                    key={s.id}
                    className={"dsh-stage " + (on ? "dsh-stage-on" : "dsh-stage-off")}
                  >{s.label}{on ? " •" : ""}</span>
                );
              })
            ) : (
              <span className="dsh-done">已完成</span>
            )}
          </div>
          {generating && (
            <div className="dsh-progress">
              <div className="dsh-progress-bar" />
            </div>
          )}
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
        </div>
      )}

      <div className="dsh-card dsh-meta">
        <div className="dsh-meta-row">
          <span className="dsh-badge dsh-badge-blue">项目标题</span>
          <input
            className="dsh-field"
            value={draft.projectTitle ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, projectTitle: e.target.value }))}
            placeholder="输入项目标题"
          />
        </div>
        <div className="dsh-meta-row-top">
          <span className="dsh-badge dsh-badge-purple">论证主线</span>
          <textarea
            className="dsh-field"
            style={{ minHeight: 60, resize: "vertical" }}
            value={draft.arc ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, arc: e.target.value }))}
            placeholder="一句话概括整篇的论证主线"
          />
        </div>
      </div>

      <div className="dsh-pages">
        {pages.map((p, i) => (
          <div key={i} className="dsh-card dsh-page">
            <div className="dsh-page-row">
              <span className="dsh-page-num">P{i + 1}</span>
              <textarea
                className="dsh-field dsh-page-idea"
                value={p.idea ?? ""}
                onChange={(e) => setPage(i, { idea: e.target.value })}
                placeholder={`第 ${i + 1} 页要传达的核心信息`}
              />
              <div className="dsh-page-ops">
                <button className="dsh-icon-btn" disabled={i === 0} onClick={() => movePage(i, -1)} title="上移">↑</button>
                <button className="dsh-icon-btn" disabled={i === pages.length - 1} onClick={() => movePage(i, 1)} title="下移">↓</button>
                <button className="dsh-icon-btn danger" onClick={() => removePage(i)} title="删除本页">🗑</button>
              </div>
            </div>

            <div className="dsh-page-opts">
              <label className="dsh-opt">
                版式
                <select value={p.layout ?? "points"} onChange={(e) => setPage(i, { layout: e.target.value })}>
                  {LAYOUTS.map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
                </select>
              </label>
              <label className="dsh-opt">
                关系图
                <select value={p.art ?? ""} onChange={(e) => setPage(i, { art: e.target.value || undefined })}>
                  <option value="">无</option>
                  {ARTS.map((a) => <option key={a} value={a}>{ART_LABEL[a]}</option>)}
                </select>
              </label>
              <label className="dsh-opt">
                角色
                <select value={p.role ?? ""} onChange={(e) => setPage(i, { role: e.target.value || undefined })}>
                  <option value="">无</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </label>
              <label className="dsh-opt">
                图标
                <select value={p.icon ?? ""} onChange={(e) => setPage(i, { icon: e.target.value || undefined })}>
                  <option value="">无</option>
                  {ICONS.map((ic) => <option key={ic} value={ic}>{ICON_EMOJI[ic]} {ic}</option>)}
                </select>
              </label>
              <button onClick={() => addPage(i)} className="dsh-ghost dsh-insert">＋ 在此后插入</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => addPage()} className="dsh-ghost dsh-add-page">
        ＋ 新增页面
      </button>

      <div className="dsh-actions">
        <button onClick={onRegenerate} disabled={generating} className="dsh-ghost">
          {generating && pages.length > 0 ? "⏳ 重新生成中…" : "🔄 重新生成大纲"}
        </button>
        <button onClick={() => onConfirm(draft)} disabled={generating} className="dsh-btn">
          {generating ? "⏳ 正在生成大纲…" : "✅ 确认大纲，生成分镜 →"}
        </button>
      </div>
    </div>
  );
}