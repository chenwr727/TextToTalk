import type { StoryPage, Task, VideoParams } from "./types";

const BASE = "/api";

let currentToken = "";

export function setToken(token: string) {
  currentToken = token;
}

function withToken(path: string): string {
  return currentToken ? `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(currentToken)}` : path;
}

async function request<T>(path: string, init?: RequestInit, errMsg = "请求失败"): Promise<T> {
  const res = await fetch(withToken(`${BASE}${path}`), init);
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    throw new Error((t as { error?: string }).error || `${errMsg}：${res.status}`);
  }
  return res.json();
}

export interface TtsEngineInfo { id: string; name: string; voices: { id: string; label: string }[] }
export function getTtsEngines(): Promise<{ defaultEngine: string; engines: TtsEngineInfo[] }> {
  return request("/tts/engines", undefined, "获取 TTS 引擎列表失败");
}

export function createGeneration(prompt: string, params: VideoParams): Promise<{ taskId: string; token: string }> {
  return request("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, params }),
  }, "创建生成失败");
}

export interface OutlineBlock { idea?: string; chart?: boolean; table?: boolean; layout?: string; art?: string; role?: string; icon?: string }
export interface Outline { projectTitle?: string; arc?: string; pages?: OutlineBlock[] }

export function subscribeOutline(
  prompt: string,
  params: VideoParams,
  onToken: (t: string) => void,
  onStage: (s: string) => void,
  onSection: (l: string) => void,
  onFinal: (outline: Outline) => void,
  onError: (e: Error) => void,
  onDone: () => void,
  onReset?: () => void,
): () => void {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(`${BASE}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, params }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}));
        const e = (t as { error?: string | { message?: string } }).error;
        throw new Error((typeof e === "string" ? e : e?.message) ?? `生成大纲失败：${res.status}`);
      }
      if (!res.body) throw new Error("响应没有内容");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = frame.split("\n");
          const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "message";
          const data = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "";
          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (event === "token" && typeof parsed?.token === "string") onToken(parsed.token);
          else if (event === "reset") onReset?.();
          else if (event === "stage" && typeof parsed?.stage === "string") onStage(parsed.stage);
          else if (event === "section" && typeof parsed?.label === "string") onSection(parsed.label);
          else if (event === "final") onFinal(parsed.outline);
          else if (event === "error") { onError(new Error(parsed?.error || "生成大纲失败")); return; }
          else if (event === "done") { onDone(); return; }
        }
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      onError(e as Error);
    }
  })();
  return () => controller.abort();
}

export function generateStoryboardFromPlan(prompt: string, outline: Outline, params: VideoParams): Promise<{ taskId: string; token: string }> {
  return request("/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, outline, params }),
  }, "创建分镜生成失败");
}

export function getTask(taskId: string): Promise<Task> {
  return request(`/tasks/${taskId}`, undefined, "获取任务失败");
}

export function subscribeStoryboard(
  taskId: string,
  onPage: (page: StoryPage) => void,
  onDone: (sb: unknown) => void,
  onError?: (e: unknown) => void,
  onToken?: (token: string) => void,
  onStage?: (stage: string) => void,
  onFinal?: (sb: unknown) => void,
  onSection?: (label: string) => void,
  onReset?: () => void
): () => void {
  const es = new EventSource(withToken(`${BASE}/stream?id=${taskId}`));
  const on = (type: string, handler: (d: any) => void) => {
    es.addEventListener(type, (e) => {
      try {
        handler(JSON.parse((e as MessageEvent).data));
      } catch (err) {
        onError?.(err);
      }
    });
  };
  on("page", (d) => onPage(d));
  on("token", (d) => { if (typeof d?.token === "string") onToken?.(d.token); });
  on("reset", () => onReset?.());
  on("stage", (d) => { if (typeof d?.stage === "string") onStage?.(d.stage); });
  on("section", (d) => { if (typeof d?.label === "string") onSection?.(d.label); });
  on("final", (d) => onFinal?.(d));
  on("done", (d) => { onDone(d); es.close(); });
  es.onerror = () => {};
  return () => es.close();
}

export function submitRender(taskId: string, params?: Partial<VideoParams>): Promise<Task> {
  return request(`/tasks/${taskId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params }),
  }, "提交渲染失败");
}

export const inlineVideoUrl = (taskId: string) => withToken(`${BASE}/tasks/${taskId}/download`);
export const downloadFileUrl = (taskId: string) => withToken(`${BASE}/tasks/${taskId}/download?download=1`);

export const frameUrl = (taskId: string, pageIndex: number) => withToken(`${BASE}/tasks/${taskId}/frames/${pageIndex}`);

export function requestPreviewFrames(taskId: string): Promise<{ ok: boolean }> {
  return request(`/tasks/${taskId}/preview-frames`, { method: "POST" }, "生成预览帧失败");
}

export function regeneratePage(taskId: string, pageIndex: number): Promise<{ ok: boolean; page?: StoryPage }> {
  return request(`/tasks/${taskId}/pages/${pageIndex}/regenerate`, { method: "POST" }, "重新生成失败");
}

export type PagePatch = Partial<Pick<StoryPage, "title" | "narration" | "captions" | "points" | "durationSec" | "layout">>;
export function updatePage(taskId: string, pageIndex: number, patch: PagePatch): Promise<{ ok: boolean; page?: StoryPage }> {
  return request(`/tasks/${taskId}/pages/${pageIndex}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }, "保存分镜失败");
}