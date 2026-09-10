import { useEffect, useRef, useState } from "react";
import type { Task, VideoParams } from "../types";
import { inlineVideoUrl, downloadFileUrl, submitRender, getTtsEngines, type TtsEngineInfo } from "../api";

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
  const [ttsEngines, setTtsEngines] = useState<TtsEngineInfo[]>([]);

  const [engine, setEngine] = useState(task?.params?.engine ?? "edge");
  const [voice, setVoice] = useState(task?.params?.voice ?? "");
  const [ttsSpeed, setTtsSpeed] = useState(task?.params?.ttsSpeed ?? 1);
  const [ttsVolume, setTtsVolume] = useState(task?.params?.ttsVolume ?? 1);
  const [narration, setNarration] = useState(task?.params?.narration !== false);
  const [bgm, setBgm] = useState(task?.params?.bgm ?? "default");
  const [subtitles, setSubtitles] = useState(task?.params?.subtitles !== false);

  const touched = useRef(false);
  const markTouched = () => { touched.current = true; };

  const syncedTaskId = useRef<string | null>(null);
  useEffect(() => {
    if (!task || syncedTaskId.current === task.taskId) return;
    syncedTaskId.current = task.taskId;
    if (touched.current) return;
    const p = task.params;
    if (p) {
      if (p.engine) setEngine(p.engine);
      if (p.voice) setVoice(p.voice);
      if (p.ttsSpeed != null) setTtsSpeed(p.ttsSpeed);
      if (p.ttsVolume != null) setTtsVolume(p.ttsVolume);
      if (p.narration != null) setNarration(p.narration);
      if (p.bgm) setBgm(p.bgm);
      if (p.subtitles != null) setSubtitles(p.subtitles);
    }
  }, [task]);

  useEffect(() => {
    let alive = true;
    getTtsEngines()
      .then((r) => {
        if (!alive) return;
        setTtsEngines(r.engines);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const currentEngine = ttsEngines.find((e) => e.id === engine) ?? ttsEngines[0];
  const currentVoices = currentEngine?.voices ?? [];

  const go = async () => {
    setRendering(true);
    try {
      const params: Partial<VideoParams> = {
        engine,
        voice,
        ttsSpeed,
        ttsVolume,
        narration,
        bgm,
        subtitles,
      };
      const t = await submitRender(taskId, params);
      onTaskChange(t);
    } finally {
      setRendering(false);
    }
  };

  const status = task?.status;
  const pct = Math.round((task?.progress ?? 0) * 100);
  const busy = status === "RENDERING" || rendering;

  return (
    <div className="dsh-render">
      <div className="dsh-card dsh-render-head">
        <div className="dsh-render-top">
          <div className="dsh-render-title-row">
            <span className="dsh-render-icon">🎬</span>
            <h2 className="dsh-render-title">渲染成片</h2>
          </div>
          <button onClick={() => onBack()} className="dsh-ghost">← 返回分镜</button>
        </div>
        <p className="dsh-render-sub">先配置配音、配乐与字幕，再点击「开始渲染」合成 MP4 讲解视频。</p>

        <div className="dsh-render-settings">
            <div className="dsh-render-settings-title">🎙️ 配音与字幕设置</div>
            <div className="dsh-render-settings-body">
              <div className="dsh-grid-2">
                <div>
                  <div className="dsh-param-label">配音引擎</div>
                  <select
                    className="dsh-field"
                    value={engine}
                    onChange={(e) => {
                      const eng = ttsEngines.find((x) => x.id === e.target.value) ?? ttsEngines[0];
                      if (!eng) return;
                      markTouched();
                      setEngine(eng.id);
                      setVoice(eng.voices[0]?.id ?? "");
                    }}
                  >
                    {ttsEngines.length === 0 && <option value="">（无可用引擎）</option>}
                    {ttsEngines.map((eng) => (
                      <option key={eng.id} value={eng.id}>{eng.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="dsh-param-label">配音音色</div>
                  <select
                    className="dsh-field"
                    value={voice}
                    onChange={(e) => { markTouched(); setVoice(e.target.value); }}
                  >
                    {currentVoices.length === 0 && <option value="">无可用音色</option>}
                    {currentVoices.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="dsh-param-label">语速（{ttsSpeed}×）</div>
                  <input
                    type="range"
                    className="dsh-range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={ttsSpeed}
                    onChange={(e) => { markTouched(); setTtsSpeed(Number(e.target.value)); }}
                  />
                </div>
                <div>
                  <div className="dsh-param-label">音量（{Math.round(ttsVolume * 100)}%）</div>
                  <input
                    type="range"
                    className="dsh-range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={ttsVolume}
                    onChange={(e) => { markTouched(); setTtsVolume(Number(e.target.value)); }}
                  />
                </div>
                <div>
                  <div className="dsh-param-label">背景配乐</div>
                  <select className="dsh-field" value={bgm} onChange={(e) => { markTouched(); setBgm(e.target.value as any); }}>
                    <option value="default">🎵 轻快配乐</option>
                    <option value="none">静音（无配乐）</option>
                  </select>
                </div>
              </div>
              <div className="dsh-checks">
                <label className="dsh-check">
                  <input type="checkbox" checked={narration} onChange={() => { markTouched(); setNarration((v) => !v); }} />
                  AI 配音
                </label>
                <label className="dsh-check">
                  <input type="checkbox" checked={subtitles} onChange={() => { markTouched(); setSubtitles((v) => !v); }} />
                  底部字幕
                </label>
              </div>
            </div>
          </div>

        {status === "DONE" && (
          <div className="dsh-media">
            <div
              className="dsh-media-main"
              style={{
                aspectRatio: task?.params?.width && task?.params?.height
                  ? `${task.params.width} / ${task.params.height}`
                  : "16 / 9",
              }}
            >
              <video
                src={inlineVideoUrl(taskId)}
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        )}

        {busy ? (
          <div>
            {task?.warning && <WarnBox text={task.warning} />}
            <div className="dsh-render-progress">
              <span>正在渲染视频，请稍候…</span>
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
            <p className="dsh-done-sub">包含配音、配乐与字幕的 MP4 已就绪，可下载或修改上方设置后重新生成。</p>
            <div className="dsh-done-actions">
              <a href={downloadFileUrl(taskId)} download className="dsh-btn">⬇ 下载 MP4</a>
              <button onClick={go} className="dsh-btn dsh-btn-secondary" disabled={rendering}>
                {rendering ? "重新生成中…" : "🔄 重新生成"}
              </button>
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
            <p className="dsh-ready-text">分镜已确认，配置好上方配音与字幕参数后即可开始渲染。</p>
            <div className="dsh-ready-actions">
              <button onClick={go} className="dsh-btn" disabled={rendering}>
                {rendering ? "开始渲染中…" : "🎬 开始渲染"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WarnBox({ text }: { text: string }) {
  return (
    <div className="dsh-warn">
      <span className="dsh-warn-icon">⚠️</span>
      <div className="dsh-warn-text">{text}</div>
    </div>
  );
}