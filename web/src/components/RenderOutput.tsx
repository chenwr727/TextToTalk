import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Task } from "../types";
import { inlineVideoUrl, downloadFileUrl, submitRender } from "../api";

export function RenderOutput({
  taskId,
  task,
  onTaskChange,
  onBack,
}: {
  taskId: string;
  task: Task | null;
  onTaskChange: (t: Task) => void;
  onBack: (focusPage?: number) => void;
}) {
  const [rendering, setRendering] = useState(false);
  const autoStarted = useRef(false);

  const go = async () => {
    setRendering(true);
    try {
      const t = await submitRender(taskId);
      onTaskChange(t);
    } finally {
      setRendering(false);
    }
  };

  useEffect(() => {
    if (autoStarted.current) return;
    if (task?.status === "REVIEWING") {
      autoStarted.current = true;
      go();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status]);

  const status = task?.status;
  const pct = Math.round((task?.progress ?? 0) * 100);
  const busy = status === "RENDERING" || rendering;

  const sb = task?.storyboard;
  const sbPages = sb?.pages ?? [];
  const totalSec = sbPages.reduce((a, p) => a + (p.durationSec || 0), 0);
  const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
  const toneLabel = { formal: "正式严谨", casual: "轻松易懂", energetic: "活泼有感染力" } as Record<string, string>;
  const toneTxt = toneLabel[task?.params?.tone ?? "casual"] ?? "轻松易懂";
  const resTxt = task?.params ? `${task.params.width}×${task.params.height}` : "1920×1080";

  return (
    <div className="dsh-render">
      <div className="dsh-card dsh-render-head">
        <button onClick={() => onBack()} className="dsh-ghost">← 返回分镜</button>
        <div className="dsh-render-title-row">
          <span className="dsh-render-icon">🎬</span>
          <h2 className="dsh-render-title">渲染成片</h2>
        </div>
        <p className="dsh-render-sub">为分镜配上 AI 配音、轻快配乐与底部字幕，合成 MP4 讲解视频。</p>

        {status === "DONE" && (
          <div className="dsh-media">
            <div className="dsh-media-main">
              <video
                src={inlineVideoUrl(taskId)}
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            </div>
            <aside className="dsh-card dsh-media-side">
              <div>
                <div className="dsh-media-side-title">分镜摘要</div>
                <div className="dsh-media-side-sub">
                  {sb?.projectTitle || "你的讲解视频"}
                </div>
              </div>
              <div className="dsh-meta-grid">
                <MetaC label="总时长" value={fmtDur(totalSec)} />
                <MetaC label="分镜页数" value={`${sbPages.length} 页`} />
                <MetaC label="画幅" value={resTxt} />
                <MetaC label="语气" value={toneTxt} />
              </div>
              <div className="dsh-chips">
                {task?.params?.narration !== false && <Chip>🎙 配音</Chip>}
                {task?.params?.subtitles !== false && <Chip>💬 字幕</Chip>}
                {task?.params?.bgm === "default" && <Chip>🎵 配乐</Chip>}
              </div>
              <div className="dsh-page-list">
                <div className="dsh-page-list-label">分镜页目</div>
                {sbPages.map((pg, i) => (
                  <div key={pg.pageIndex ?? i} className="dsh-page-item">
                    <span className="dsh-page-item-num">{i + 1}</span>
                    <div className="dsh-page-item-body">
                      <div className="dsh-page-item-title">{pg.title}</div>
                      <div className="dsh-page-item-dur">约 {fmtDur(pg.durationSec || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {busy ? (
          <div>
            {task?.warning && <WarnBox text={task.warning} />}
            <div className="dsh-render-progress">
              <span>正在渲染…（这一步约需几十秒）</span>
              <b>{pct}%</b>
            </div>
            <div className="dsh-progress dsh-render-progress-bar">
              <div className="dsh-progress-bar" />
            </div>
          </div>
        ) : status === "DONE" ? (
          <div className="dsh-done-box">
            {task?.warning && <WarnBox text={task.warning} />}
            <div className="dsh-done-emoji">🎉</div>
            <p className="dsh-done-title">视频渲染完成</p>
            <p className="dsh-done-sub">包含配音、配乐与字幕的 MP4 已就绪，可下载或重新返回微调分镜。</p>
            <div className="dsh-done-actions">
              <a href={downloadFileUrl(taskId)} download className="dsh-btn">⬇ 下载 MP4</a>
              <button onClick={() => onBack()} className="dsh-ghost">← 返回分镜</button>
            </div>
          </div>
        ) : status === "FAILED" ? (
          <div className="dsh-fail">
            <b className="dsh-fail-title">渲染失败</b>
            <div className="dsh-fail-msg">{task?.error}</div>
            <div className="dsh-fail-actions">
              <button onClick={go} className="dsh-btn" disabled={rendering}>{rendering ? "重新渲染中…" : "重新渲染"}</button>
              <button onClick={() => onBack()} className="dsh-ghost">返回分镜调整</button>
            </div>
          </div>
        ) : (
          <div className="dsh-ready">
            <p className="dsh-ready-text">分镜已确认，正在准备渲染…</p>
            <div className="dsh-progress dsh-ready-bar">
              <div className="dsh-progress-bar" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaC({ label, value }: { label: string; value: string }) {
  return (
    <div className="dsh-meta-cell">
      <div className="dsh-meta-cell-label">{label}</div>
      <div className="dsh-meta-cell-value">{value}</div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="dsh-chip">{children}</span>;
}

function WarnBox({ text }: { text: string }) {
  return (
    <div className="dsh-warn">
      <span className="dsh-warn-icon">⚠️</span>
      <div className="dsh-warn-text">{text}</div>
    </div>
  );
}