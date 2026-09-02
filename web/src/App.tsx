import { useEffect, useRef, useState } from "react";
import type { StoryPage, Task, VideoParams } from "./types";
import { subscribeOutline, generateStoryboardFromPlan, getTask, setToken, type Outline } from "./api";
import { ScriptInput } from "./components/ScriptInput";
import { OutlinePreview } from "./components/OutlinePreview";
import { StoryboardPreview } from "./components/StoryboardPreview";
import { RenderOutput } from "./components/RenderOutput";

type Phase = "input" | "outline" | "storyboard" | "render";

const STEPS: { id: Phase; label: string; desc: string }[] = [
  { id: "input", label: "文案脚本", desc: "输入文案与参数" },
  { id: "outline", label: "大纲生成", desc: "AI 规划 · 确认后分镜" },
  { id: "storyboard", label: "分镜预览", desc: "AI 逐页生成 · 可重做" },
  { id: "render", label: "渲染成片", desc: "配音 · 配乐 · 导出" },
];

export function App() {
  const [phase, setPhase] = useState<Phase>("input");
  const [taskId, setTaskId] = useState<string>("");

  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<VideoParams>({
    width: 1920,
    height: 1080,
    fps: 30,
    tone: "casual",
    narration: true,
    subtitles: true,
    bgm: "default",
    granularity: "medium",
    theme: "tech",
    audience: "",
    coreMessage: "",
    audienceOutcome: "",
    voice: "zh-CN-XiaoxiaoNeural",
    ttsSpeed: 1,
    ttsVolume: 1,
  });

  const [outline, setOutline] = useState<Outline | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineTokens, setOutlineTokens] = useState("");
  const [outlineStage, setOutlineStage] = useState("");
  const outlineAbortRef = useRef<(() => void) | null>(null);

  const [pages, setPages] = useState<StoryPage[]>([]);
  const [done, setDone] = useState(false);
  const [tokens, setTokens] = useState("");
  const [stage, setStage] = useState("plan");

  const [task, setTask] = useState<Task | null>(null);

  const [focusPage, setFocusPage] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "render" || !taskId) return;
    let stop = false;
    const timer = setInterval(async () => {
      if (stop) return;
      try {
        const t = await getTask(taskId);
        if (!stop) setTask(t);
        if (t.status === "DONE" || t.status === "FAILED") clearInterval(timer);
      } catch { /* 轮询容错 */ }
    }, 1200);
    return () => { stop = true; clearInterval(timer); };
  }, [phase, taskId, task?.status]);

  const startOutlineStream = (p: string, pr: VideoParams, onErrorBack?: () => void) => {
    outlineAbortRef.current?.();
    setOutlineLoading(true);
    setOutlineTokens("");
    setOutlineStage("");
    outlineAbortRef.current = subscribeOutline(
      p,
      pr,
      (tok) => setOutlineTokens((prev) => prev + tok),
      (s) => setOutlineStage(s),
      () => {},
      (o) => setOutline(o),
      (e) => {
        alert((e as Error).message || "大纲生成失败，请重试");
        if (onErrorBack) onErrorBack();
      },
      () => setOutlineLoading(false),
      () => setOutlineTokens(""),
    );
  };

  const handleSubmit = (p: string, pr: VideoParams) => {
    setPrompt(p);
    setParams(pr);
    setOutline(null);
    setPhase("outline");
    startOutlineStream(p, pr, () => setPhase("input"));
  };

  const handleRegenerateOutline = () => {
    startOutlineStream(prompt, params);
  };

  const handleConfirmOutline = async (edited?: Outline) => {
    const finalOutline = edited ?? outline;
    if (!finalOutline) return;
    setOutline(finalOutline);
    setOutlineLoading(true);
    try {
      const { taskId, token } = await generateStoryboardFromPlan(prompt, finalOutline, params);
      setToken(token);
      setTaskId(taskId);
      setPages([]);
      setDone(false);
      setTokens("");
      setStage("plan");
      setTask(null);
      setPhase("storyboard");
    } catch (e) {
      alert((e as Error).message || "分镜生成失败，请重试");
    } finally {
      setOutlineLoading(false);
    }
  };

  const cur = STEPS.findIndex((s) => s.id === phase);

  return (
    <div className="dsh-app" style={{ minHeight: "100vh", padding: "26px 18px 60px" }}>
      <header style={{ maxWidth: 1320, margin: "0 auto 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/favicon.svg" alt="TextToTalk" width={42} height={42} style={{ borderRadius: 13, boxShadow: "0 4px 14px rgba(47,109,246,.32)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1e2a3a", lineHeight: 1.15 }}>🎬 TextToTalk</div>
            <div style={{ fontSize: 12, color: "#8a99b0", letterSpacing: .3 }}>文案一键变讲解视频</div>
          </div>
        </div>

        <div className="dsh-card dsh-steps" style={{ padding: "16px 18px 14px", marginTop: 22, background: "rgba(255,255,255,.85)" }}>
          <div style={{ display: "flex", width: "100%" }}>
            {STEPS.map((s, i) => {
              const active = i === cur;
              const doneStep = i < cur;
              return (
                <div key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 15,
                    background: active ? "linear-gradient(135deg,#2f6df6,#5c7dff)" : doneStep ? "#2f6df6" : "#e8eefb",
                    color: active ? "#fff" : doneStep ? "#fff" : "#93a3c0",
                    boxShadow: active ? "0 4px 12px rgba(47,109,246,.35)" : "none",
                    zIndex: 1,
                  }}>{doneStep ? "✓" : i + 1}</span>
                  <span className="dsh-step-label" style={{ fontSize: 14, fontWeight: 700, color: active ? "#2f6df6" : doneStep ? "#1e2a3a" : "#8a9ab4", whiteSpace: "nowrap", marginTop: 7 }}>{s.label}</span>
                  <span className="dsh-step-desc" style={{ fontSize: 11, color: active ? "#7f97c9" : "#a7b4cc", whiteSpace: "nowrap", marginTop: 2, textAlign: "center" }}>{s.desc}</span>
                  {i < STEPS.length - 1 && (
                    <div style={{ position: "absolute", top: 17, left: "calc(50% + 22px)", right: "calc(-50% + 22px)", height: 2, background: doneStep ? "#2f6df6" : "#dfe7f5" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto" }}>
        {phase === "input" && (
          <ScriptInput
            prompt={prompt}
            params={params}
            onPromptChange={setPrompt}
            onParamsChange={setParams}
            onSubmit={handleSubmit}
          />
        )}
        {phase === "outline" && (
          <OutlinePreview
            outline={outline ?? { pages: [] }}
            generating={outlineLoading}
            tokens={outlineTokens}
            stage={outlineStage}
            onConfirm={handleConfirmOutline}
            onRegenerate={handleRegenerateOutline}
            onBack={() => setPhase("input")}
          />
        )}
        {phase === "storyboard" && (
          <StoryboardPreview
            taskId={taskId}
            pages={pages}
            done={done}
            tokens={tokens}
            stage={stage}
            onPagesChange={setPages}
            onDoneChange={setDone}
            onTokensChange={setTokens}
            onStageChange={setStage}
            focusPage={focusPage}
            onFocusPageHandled={() => setFocusPage(null)}
            theme={params.theme}
            onConfirm={() => {
              setTask(null);
              setFocusPage(null);
              setPhase("render");
            }}
            onBack={() => setPhase("outline")}
          />
        )}
        {phase === "render" && (
          <RenderOutput
            taskId={taskId}
            task={task}
            onTaskChange={setTask}
            onBack={(p) => {
              setFocusPage(p ?? null);
              setPhase("storyboard");
            }}
          />
        )}
      </main>
    </div>
  );
}