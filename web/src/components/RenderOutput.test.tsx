import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * 「逐页预览 → 去改这页」是 focusPage 的唯一产品入口：
 * StoryboardPreview 早就支持按页码滚动 + 高亮，但渲染完成页从来没把页码传回去过，
 * 于是整条链路一直是死代码。这里锁住入口，避免以后又把按钮接回无参的 onBack()。
 */

const requestPreviewFrames = vi.fn().mockResolvedValue({ ok: true });

vi.mock("../api", () => ({
  inlineVideoUrl: (id: string) => `/api/tasks/${id}/inline`,
  downloadFileUrl: (id: string) => `/api/tasks/${id}/download`,
  frameUrl: (id: string, i: number) => `/api/tasks/${id}/frames/${i}`,
  requestPreviewFrames: (id: string) => requestPreviewFrames(id),
  submitRender: vi.fn(),
  getTtsEngines: vi.fn().mockResolvedValue({ engines: [] }),
}));

import { RenderOutput } from "./RenderOutput";
import type { Task } from "../types";

const makeTask = () =>
  ({
    taskId: "t1",
    token: "tk",
    status: "DONE",
    prompt: "",
    params: {},
    storyboard: {
      projectTitle: "测试",
      pages: [
        { pageIndex: 0, title: "第一页" },
        { pageIndex: 1, title: "第二页" },
        { pageIndex: 2, title: "第三页" },
      ],
    },
    progress: 1,
    error: null,
    warning: null,
    outputUrl: "/out.mp4",
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Task;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RenderOutput：逐页预览入口", () => {
  it("成片就绪后按页请求预览帧并渲染对应数量的入口", () => {
    render(<RenderOutput taskId="t1" task={makeTask()} onTaskChange={() => {}} onBack={() => {}} />);
    expect(requestPreviewFrames).toHaveBeenCalledWith("t1");
    expect(screen.getAllByText("去改这页")).toHaveLength(3);
    // 页码从 1 开始展示
    expect(screen.getByText("第 3 页")).toBeTruthy();
  });

  it("点第 N 页的「去改这页」把 N 传给 onBack（1 基）", () => {
    const onBack = vi.fn();
    render(<RenderOutput taskId="t1" task={makeTask()} onTaskChange={() => {}} onBack={onBack} />);
    fireEvent.click(screen.getAllByText("去改这页")[2]);
    expect(onBack).toHaveBeenCalledWith(3);
  });

  it("未渲染完成时不请求预览帧，也不显示逐页预览", () => {
    const task = { ...makeTask(), status: "READY" } as unknown as Task;
    render(<RenderOutput taskId="t1" task={task} onTaskChange={() => {}} onBack={() => {}} />);
    expect(requestPreviewFrames).not.toHaveBeenCalled();
    expect(screen.queryByText("去改这页")).toBeNull();
  });
});
