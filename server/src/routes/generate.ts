import type { FastifyInstance } from "fastify";
import { generateStoryboard, generateOutline, generateFromPlan } from "../services/storyboardGenerator.js";
import { createTask, patchTask } from "../services/taskStore.js";
import { collectStoryboardWarnings } from "../services/normalize.js";
import { publish, setupSseStream } from "../services/sseHub.js";
import type { VideoParams } from "../types.js";
import { normalizeParams } from "./params.js";
import type { Plan } from "../services/normalize.js";
import { resolvePrompt } from "../services/fetchUrl.js";

export function registerGenerateRoutes(app: FastifyInstance) {
  app.post("/api/generate", async (req, reply) => {
    const body = req.body as { prompt?: string; params?: VideoParams };
    const raw = (body?.prompt ?? "").trim();
    if (!raw) {
      return reply.code(400).send({ error: { code: "EMPTY_PROMPT", message: "文案不能为空" } });
    }
    const params: VideoParams = normalizeParams(body?.params);
    const task = createTask({
      status: "GENERATING",
      prompt: raw,
      params,
      storyboard: null,
      progress: 0,
      error: null,
      warning: null,
      outputUrl: null,
    });

    runGeneration(task.taskId, raw, params).catch((e) => {
      patchTask(task.taskId, { status: "FAILED", error: String(e) });
    });

    return reply.send({ taskId: task.taskId, token: task.token, status: task.status });
  });

  app.post("/api/outline", async (req, reply) => {
    const body = req.body as { prompt?: string; params?: VideoParams };
    const raw = (body?.prompt ?? "").trim();
    if (!raw) {
      return reply.code(400).send({ error: { code: "EMPTY_PROMPT", message: "文案不能为空" } });
    }
    const params: VideoParams = normalizeParams(body?.params);
    const { push, close } = setupSseStream(reply);
    try {
      const { prompt, fromUrl, urlTitle } = await resolvePrompt(raw);
      push("meta", { status: "thinking" });
      const outline = await generateOutline(prompt, (tok) => {
        push("token", { token: tok });
      }, (stage) => {
        push("stage", { stage });
      }, (label) => {
        push("section", { label });
      }, params, () => {
        push("reset", {});
      });
      if (!outline.pages?.length) {
        push("error", { error: "未能生成大纲，请重试" });
      } else {
        push("final", { outline, fromUrl, urlTitle });
      }
    } catch (e) {
      console.error("[outline] 生成失败", e);
      push("error", { error: (e as Error).message });
    } finally {
      push("done", {});
      close();
    }
    return reply;
  });

  app.post("/api/storyboard", async (req, reply) => {
    const body = req.body as { prompt?: string; outline?: Plan; params?: VideoParams };
    const prompt = (body?.prompt ?? "").trim();
    const outline = body?.outline;
    if (!prompt) {
      return reply.code(400).send({ error: { code: "EMPTY_PROMPT", message: "文案不能为空" } });
    }
    if (!outline?.pages?.length) {
      return reply.code(400).send({ error: { code: "EMPTY_OUTLINE", message: "缺少已确认的大纲" } });
    }
    const params: VideoParams = normalizeParams(body?.params);
    const task = createTask({
      status: "GENERATING",
      prompt,
      params,
      storyboard: null,
      progress: 0,
      error: null,
      warning: null,
      outputUrl: null,
    });

    runFromPlan(task.taskId, prompt, outline, params).catch((e) => {
      patchTask(task.taskId, { status: "FAILED", error: String(e) });
    });

    return reply.send({ taskId: task.taskId, token: task.token, status: task.status });
  });
}

async function runGeneration(taskId: string, rawPrompt: string, params: VideoParams) {
  await sleep(150);
  publish(taskId, "meta", { status: "thinking" });
  let prompt = rawPrompt;
  try {
    const r = await resolvePrompt(rawPrompt);
    prompt = r.prompt;
    patchTask(taskId, { prompt });
  } catch (e) {
    console.warn("[generate] 网址抓取失败，改用原文案:", (e as Error).message);
  }
  try {
    const { storyboard, plan } = await generateStoryboard(prompt, params, (tok) => {
      publish(taskId, "token", { token: tok });
    }, (stage) => {
      publish(taskId, "stage", { stage });
    }, (page) => {
      publish(taskId, "page", page);
    }, (label) => {
      publish(taskId, "section", { label });
    }, () => {
      publish(taskId, "reset", {});
    });
    patchTask(taskId, { status: "REVIEWING", storyboard, warning: collectStoryboardWarnings(storyboard, plan) });
    publish(taskId, "final", storyboard);
    publish(taskId, "done", storyboard);
  } catch (e) {
    console.error("[generate] LLM 失败", e);
    patchTask(taskId, { status: "FAILED", error: (e as Error).message });
    publish(taskId, "error", { error: (e as Error).message });
  }
}

async function runFromPlan(taskId: string, prompt: string, outline: Plan, params: VideoParams) {
  await sleep(150);
  publish(taskId, "meta", { status: "thinking" });
  try {
    const storyboard = await generateFromPlan(prompt, outline, params, (tok) => {
      publish(taskId, "token", { token: tok });
    }, (stage) => {
      publish(taskId, "stage", { stage });
    }, (page) => {
      publish(taskId, "page", page);
    }, (label) => {
      publish(taskId, "section", { label });
    }, () => {
      publish(taskId, "reset", {});
    });
    patchTask(taskId, { status: "REVIEWING", storyboard, warning: collectStoryboardWarnings(storyboard, outline) });
    publish(taskId, "final", storyboard);
    publish(taskId, "done", storyboard);
  } catch (e) {
    console.error("[storyboard] LLM 失败", e);
    patchTask(taskId, { status: "FAILED", error: (e as Error).message });
    publish(taskId, "error", { error: (e as Error).message });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}