import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OutlinePreview } from "./OutlinePreview";
import type { Outline } from "../api";

const outline = (projectTitle: string, ideas: string[]): Outline => ({
  projectTitle,
  arc: `${projectTitle} 的论证主线`,
  pages: ideas.map((idea) => ({ idea, layout: "points", role: "build" })),
});

const baseProps = {
  generating: false,
  tokens: "",
  stage: "plan",
  onConfirm: () => {},
  onRegenerate: () => {},
  onBack: () => {},
};

/** 读出当前渲染出的每页核心信息，用于断言草稿内容 */
const ideaValues = () =>
  screen.getAllByPlaceholderText(/第 \d+ 页要传达的核心信息/).map((el) => (el as HTMLTextAreaElement).value);

const titleValue = () => (screen.getByPlaceholderText("输入项目标题") as HTMLInputElement).value;

describe("OutlinePreview 大纲 → 草稿同步", () => {
  test("挂载时已有大纲：直接渲染各页内容", () => {
    render(<OutlinePreview outline={outline("标题", ["一", "二"])} {...baseProps} />);

    expect(ideaValues()).toEqual(["一", "二"]);
    expect(titleValue()).toBe("标题");
  });

  test("大纲迟到（首帧为空、SSE 回流后才到）：草稿跟着补上", () => {
    const { rerender } = render(<OutlinePreview outline={{ projectTitle: "", arc: "", pages: [] }} {...baseProps} />);
    expect(screen.queryAllByPlaceholderText(/要传达的核心信息/)).toHaveLength(0);

    rerender(<OutlinePreview outline={outline("迟到标题", ["甲", "乙"])} {...baseProps} />);
    expect(ideaValues()).toEqual(["甲", "乙"]);
    expect(titleValue()).toBe("迟到标题");
  });

  test("回归：重新生成大纲且页数不变时，预览必须刷新（旧实现只比页数，会沿用旧草稿）", () => {
    const { rerender } = render(<OutlinePreview outline={outline("旧标题", ["旧一", "旧二"])} {...baseProps} />);
    expect(ideaValues()).toEqual(["旧一", "旧二"]);

    // 页数同为 2、但对象是新的
    rerender(<OutlinePreview outline={outline("新标题", ["新一", "新二"])} {...baseProps} />);

    expect(ideaValues()).toEqual(["新一", "新二"]);
    expect(titleValue()).toBe("新标题");
  });

  test("回归：用户编辑不会被父组件重渲染覆盖（outline 引用未变）", () => {
    const incoming = outline("标题", ["原始内容"]);
    const { rerender } = render(<OutlinePreview outline={incoming} {...baseProps} />);

    fireEvent.change(screen.getByPlaceholderText(/第 1 页要传达的核心信息/), {
      target: { value: "我手工改过的" },
    });
    expect(ideaValues()).toEqual(["我手工改过的"]);

    // 父组件因 token 继续流入而重渲染，outline 仍是同一个对象
    rerender(<OutlinePreview outline={incoming} {...baseProps} tokens="更多 token" />);

    expect(ideaValues()).toEqual(["我手工改过的"]);
  });

  test("页数变化时仍然整体同步", () => {
    const { rerender } = render(<OutlinePreview outline={outline("标题", ["一"])} {...baseProps} />);
    rerender(<OutlinePreview outline={outline("标题", ["一", "二", "三"])} {...baseProps} />);

    expect(ideaValues()).toEqual(["一", "二", "三"]);
  });
});
