import { useState, type ReactNode } from "react";
import type { StoryPage, Layout } from "../types";
import { updatePage, regeneratePage, type PagePatch } from "../api";
import { LAYOUT_LABEL } from "./labels";

function mergePoints(orig: StoryPage["points"], texts: string[]): StoryPage["points"] {
  const sameCount = texts.length === orig.length;
  return texts.map((text, i) => {
    const o = sameCount ? orig[i] : undefined;
    if (o && typeof o === "object" && (o.icon || o.anchor !== undefined)) {
      return { text, ...(o.icon ? { icon: o.icon } : {}), ...(o.anchor !== undefined ? { anchor: o.anchor } : {}) };
    }
    return text;
  });
}

export function PageEditor({
  taskId,
  page,
  onSave,
  onCancel,
  onRegenerating,
}: {
  taskId: string;
  page: StoryPage;
  onSave: (p: StoryPage) => void;
  onCancel: () => void;
  onRegenerating?: (b: boolean) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [captions, setCaptions] = useState(page.captions.join("，"));
  const [points, setPoints] = useState(page.points.map((p) => (typeof p === "string" ? p : p.text)).join("\n"));
  const [durationSec, setDurationSec] = useState(String(page.durationSec));
  const [layout, setLayout] = useState<Layout>(page.layout ?? "points");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);

  const originalLayout = page.layout ?? "points";

  const LAYOUTS: Layout[] = ["title", "section", "points", "three_card", "comparison", "chart", "table", "end", "two_column", "steps", "stats", "qa"];

  const onSaveClick = async () => {
    if (!title.trim()) { setError("标题不能为空"); return; }
    const dur = Number(durationSec);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 120) { setError("时长需为 0~120 之间的秒数"); return; }

    if (layout !== originalLayout) {
      setShowLayoutDialog(true);
      return;
    }
    return doSave(dur, false);
  };

  const doSave = async (dur: number, regenerate: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const patch: PagePatch = {
        title: title.trim(),
        captions: captions.split(/[，,]/).map((s) => s.trim()).filter(Boolean),
        points: mergePoints(page.points, points.split("\n").map((s) => s.trim()).filter(Boolean)),
        durationSec: dur,
        layout,
      };
      const r = await updatePage(taskId, page.pageIndex, patch);
      if (!r.ok || !r.page) { setError("保存失败，请重试"); return; }

      if (regenerate) {
        onRegenerating?.(true);
        onCancel();
        try {
          const rr = await regeneratePage(taskId, page.pageIndex);
          if (rr.ok && rr.page) {
            onSave({ ...rr.page, pageIndex: page.pageIndex });
          } else {
            onSave({ ...r.page, pageIndex: page.pageIndex });
          }
        } finally {
          onRegenerating?.(false);
        }
        return;
      }
      onSave({ ...r.page, pageIndex: page.pageIndex });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const captionCount = captions.split(/[，,]/).map((s) => s.trim()).filter(Boolean).length;
  const pointCount = points.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="dsh-editor">
      <div className="dsh-editor-head">
        <span className="dsh-editor-badge">P{page.pageIndex + 1}</span>
        <span className="dsh-editor-title">编辑本页</span>
        <span className="dsh-editor-sub">保存后旧成片会失效，需重新渲染</span>
      </div>

      <div className="dsh-editor-grid">
        <div className="dsh-editor-col">
          {field("标题", <input className="dsh-field" value={title} onChange={(e) => setTitle(e.target.value)} />)}
          {field(
            "解说词 / 字幕",
            <textarea
              className="dsh-field dsh-editor-body"
              placeholder="每句用逗号分隔"
              value={captions}
              onChange={(e) => setCaptions(e.target.value)}
            />,
            "配音与画面字幕都以此为准",
            `${captionCount} 句`,
          )}
        </div>
        <div className="dsh-editor-col">
          {field(
            "要点",
            <textarea
              className="dsh-field dsh-editor-body"
              placeholder="每行一条"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />,
            undefined,
            `${pointCount} 条`,
          )}
          <div className="dsh-editor-row">
            {field("时长（秒）", (
              <input className="dsh-field" type="number" min={1} max={120} value={durationSec} onChange={(e) => setDurationSec(e.target.value)} />
            ))}
            {field("版式", (
              <select className="dsh-field" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
                {LAYOUTS.map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l] ?? l}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="dsh-editor-error">⚠️ {error}</div>}
      <div className="dsh-editor-actions">
        <button onClick={onCancel} className="dsh-ghost" disabled={saving}>取消</button>
        <button onClick={onSaveClick} className="dsh-btn" disabled={saving}>
          {saving ? "保存中…" : "保存修改"}
        </button>
      </div>

      {showLayoutDialog && (
        <div
          className="dsh-modal-mask"
          onClick={() => !saving && setShowLayoutDialog(false)}
        >
          <div
            className="dsh-card dsh-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dsh-modal-head">
              <span className="dsh-modal-icon">🔄</span>
              <div className="dsh-modal-title">版式已更改</div>
            </div>
            <div className="dsh-modal-body">
              本页版式已改为
              <b>{LAYOUT_LABEL[layout] ?? layout}</b>
              。是否让 AI 按新版式重新生成本页内容？
            </div>
            <div className="dsh-modal-tip">
              <div>· 重新生成：要点/图表等内容与新版式更贴合（耗时略长）</div>
              <div>· 仅保存：保留现有内容，只换版式</div>
            </div>
            <div className="dsh-modal-actions">
              <button className="dsh-ghost" disabled={saving} onClick={() => setShowLayoutDialog(false)}>取消</button>
              <button className="dsh-ghost" disabled={saving} onClick={() => { setShowLayoutDialog(false); doSave(Number(durationSec), false); }}>
                仅保存
              </button>
              <button className="dsh-btn" disabled={saving} onClick={() => { setShowLayoutDialog(false); doSave(Number(durationSec), true); }}>
                {saving ? "生成中…" : "重新生成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function field(label: string, children: ReactNode, hint?: string, meta?: string) {
  return (
    <label className="dsh-field-label">
      <div className="dsh-field-label-head">
        <span className="dsh-field-label-text">{label}</span>
        {meta != null && <span className="dsh-field-label-meta">{meta}</span>}
      </div>
      {children}
      {hint && <div className="dsh-field-hint">{hint}</div>}
    </label>
  );
}