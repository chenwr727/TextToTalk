import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { regeneratePage } from "../services/storyboardGenerator.js";
import { getTask, patchTask } from "../services/taskStore.js";
import { publish } from "../services/sseHub.js";
import { renderTaskInBackground, OUT_DIR } from "../services/renderService.js";
import { renderPageFrames } from "../services/frameExtract.js";
import { authorizeTask } from "../services/auth.js";

export function registerTaskRoutes(app: FastifyInstance) {
  app.get("/api/tasks/:id", async (req, reply) => {
    const taskId = String((req.params as { id: string }).id);
    const task = authorizeTask(req, reply, taskId);
    if (!task) return reply;
    return reply.send(task);
  });

  app.post("/api/tasks/:id/render", async (req, reply) => {
    const taskId = String((req.params as { id: string }).id);
    const task = authorizeTask(req, reply, taskId);
    if (!task) return reply;
    if (!task.storyboard) return reply.code(409).send({ error: "storyboard 未就绪" });
    patchTask(taskId, { status: "RENDERING", progress: 0 });
    void renderTaskInBackground(taskId);
    return reply.send(getTask(taskId));
  });

  app.get("/api/tasks/:id/download", async (req, reply) => {
    const taskId = String((req.params as { id: string }).id);
    const task = authorizeTask(req, reply, taskId);
    if (!task) return reply;
    const mp4 = path.join(OUT_DIR, `${taskId}.mp4`);
    if (!existsSync(mp4)) return reply.code(404).send({ error: "产物不存在，请先渲染" });
    const q = (req as any).query as Record<string, string> | undefined;
    const asAttachment = q?.download === "1";
    const stat = statSync(mp4);
    const range = (req.headers.range as string) || "";
    reply
      .type("video/mp4")
      .header("Accept-Ranges", "bytes")
      .header("Access-Control-Allow-Origin", "*")
      .header("Content-Disposition", asAttachment
        ? `attachment; filename="${taskId}.mp4"`
        : `inline; filename="${taskId}.mp4"`);
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      end = Math.min(end, stat.size - 1);
      if (start >= stat.size || end < start) {
        return reply.code(416).header("Content-Range", `bytes */${stat.size}`).send();
      }
      return reply
        .code(206)
        .header("Content-Range", `bytes ${start}-${end}/${stat.size}`)
        .header("Content-Length", String(end - start + 1))
        .send(createReadStream(mp4, { start, end }));
    }
    reply.header("Content-Length", String(stat.size));
    return reply.send(createReadStream(mp4));
  });

  app.post("/api/tasks/:id/preview-frames", async (req, reply) => {
    const taskId = String((req.params as { id: string }).id);
    const task = authorizeTask(req, reply, taskId);
    if (!task || !task.storyboard) return reply.code(404).send({ error: "任务或分镜不存在" });
    void renderPageFrames(taskId, task.storyboard, task.storyboard.pages as any[], task.params.fps || 30, undefined, {
      theme: task.params.theme, width: task.params.width, height: task.params.height,
    })
      .then((paths) => console.log(`[frame] 已生成 ${paths.length} 页预览帧 (${taskId})`))
      .catch((e) => console.warn("[frame] 预览帧生成失败:", e));
    return { ok: true };
  });

  app.get("/api/tasks/:id/frames/:page", async (req, reply) => {
    const { id, page } = req.params as { id: string; page: string };
    const task = authorizeTask(req, reply, id);
    if (!task) return reply;
    const idx = Number(page);
    if (!Number.isInteger(idx) || idx < 0) return reply.code(400).send({ error: "页索引非法" });
    const png = path.join(OUT_DIR, id, "frames", `p${idx}.png`);
    if (!existsSync(png)) return reply.code(404).send({ error: "该页预览帧不存在，请先渲染成片" });
    return reply
      .type("image/png")
      .header("Cache-Control", "public, max-age=86400")
      .header("Access-Control-Allow-Origin", "*")
      .send(createReadStream(png));
  });

  app.patch("/api/tasks/:id/pages/:page", async (req, reply) => {
    const { id, page } = req.params as { id: string; page: string };
    const task = authorizeTask(req, reply, id);
    if (!task || !task.storyboard) return reply.code(404).send({ error: "任务或分镜不存在" });
    const idx = Number(page);
    if (!Number.isInteger(idx) || idx < 0 || idx >= task.storyboard.pages.length)
      return reply.code(400).send({ error: "页索引非法" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (Object.keys(body).length === 0) return reply.code(400).send({ error: "没有可更新的字段" });

    const cur = task.storyboard.pages[idx];
    const next: typeof cur = { ...cur };

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) return reply.code(400).send({ error: "title 必须是非空字符串" });
      next.title = body.title.trim();
    }
    if (body.narration !== undefined) {
      if (typeof body.narration !== "string") return reply.code(400).send({ error: "narration 必须是字符串" });
      next.narration = body.narration;
    }
    if (body.captions !== undefined) {
      if (!Array.isArray(body.captions) || body.captions.some((c) => typeof c !== "string"))
        return reply.code(400).send({ error: "captions 必须是字符串数组" });
      next.captions = body.captions;
    }
    if (body.points !== undefined) {
      if (!Array.isArray(body.points)) return reply.code(400).send({ error: "points 必须是数组" });
      next.points = body.points.map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && typeof (p as any).text === "string") return { text: (p as any).text, icon: (p as any).icon ?? null };
        throw new Error("points 元素必须是字符串或 {text,icon} 对象");
      });
    }
    if (body.durationSec !== undefined) {
      const d = Number(body.durationSec);
      if (!Number.isFinite(d) || d <= 0 || d > 120) return reply.code(400).send({ error: "durationSec 必须是 0~120 之间的秒数" });
      next.durationSec = d;
    }
    if (body.layout !== undefined) {
      const LAYOUTS = ["title", "section", "points", "three_card", "comparison", "chart", "table", "end", "two_column", "steps", "stats", "qa", "map"];
      if (typeof body.layout !== "string" || !LAYOUTS.includes(body.layout))
        return reply.code(400).send({ error: `layout 必须是 ${LAYOUTS.join("/")} 之一` });
      next.layout = body.layout as typeof cur.layout;
      next.chart = body.layout === "chart" ? next.chart : null;
      next.table = body.layout === "table" ? next.table : null;
      next.art = null;
    }

    const updated = { ...task.storyboard, pages: task.storyboard.pages.map((p, i) => (i === idx ? next : p)) };
    const prevStatus = task.status;
    const invalidated = prevStatus === "DONE" || prevStatus === "FAILED" || prevStatus === "RENDERING";
    if (invalidated) {
      const mp4 = path.join(OUT_DIR, `${id}.mp4`);
      const framesDir = path.join(OUT_DIR, id, "frames");
      for (const f of [mp4, framesDir]) {
        try { if (existsSync(f)) rmSync(f, { recursive: true, force: true }); } catch { /* 忽略清理失败 */ }
      }
    }
    patchTask(id, {
      storyboard: updated,
      ...(invalidated ? { status: "REVIEWING", outputUrl: null, progress: 0 } : {}),
    });
    publish(id, "page", next);
    return { ok: true, page: next, invalidated };
  });

  app.post("/api/tasks/:id/pages/:page/regenerate", async (req, reply) => {
    const { id, page } = req.params as { id: string; page: string };
    const task = authorizeTask(req, reply, id);
    if (!task || !task.storyboard) return reply.code(404).send({ error: "任务或分镜不存在" });
    const idx = Number(page);
    if (!Number.isInteger(idx) || idx < 0 || idx >= task.storyboard.pages.length)
      return reply.code(400).send({ error: "页索引非法" });
    try {
      const newPage = await regeneratePage(task.prompt, task.storyboard, idx, task.params);
      if (!newPage) return reply.code(500).send({ error: "重生成失败" });
      const next = { ...task.storyboard, pages: task.storyboard.pages.map((p, i) => (i === idx ? newPage : p)) };
      const prevStatus = task.status;
      const invalidated = prevStatus === "DONE" || prevStatus === "FAILED" || prevStatus === "RENDERING";
      if (invalidated) {
        const mp4 = path.join(OUT_DIR, `${id}.mp4`);
        const framesDir = path.join(OUT_DIR, id, "frames");
        for (const f of [mp4, framesDir]) {
          try { if (existsSync(f)) rmSync(f, { recursive: true, force: true }); } catch { /* 忽略清理失败 */ }
        }
      }
      patchTask(id, {
        storyboard: next,
        ...(invalidated ? { status: "REVIEWING", outputUrl: null, progress: 0 } : {}),
      });
      publish(id, "page", newPage);
      return { ok: true, page: newPage, invalidated };
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message });
    }
  });
}