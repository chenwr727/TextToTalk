import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { StoryPage } from "../types";

const subscribeStoryboard = vi.fn();
const getTask = vi.fn();
const regeneratePage = vi.fn();

vi.mock("../api", () => ({
  subscribeStoryboard: (...args: unknown[]) => subscribeStoryboard(...args),
  getTask: (...args: unknown[]) => getTask(...args),
  regeneratePage: (...args: unknown[]) => regeneratePage(...args),
}));
// 缩略图会拉起整套 Remotion 场景组件，与本文件要验证的 hook 行为无关，桩掉
vi.mock("./RenderThumb", () => ({ RenderThumb: () => <div data-testid="thumb" /> }));
vi.mock("./PageEditor", () => ({ PageEditor: () => <div data-testid="editor" /> }));

import { StoryboardPreview } from "./StoryboardPreview";

/** subscribeStoryboard 的第 n 个回调（0 是 taskId） */
const cb = (n: number) => subscribeStoryboard.mock.calls[0][n] as (...args: unknown[]) => void;

const makePage = (i: number): StoryPage =>
  ({
    pageIndex: i,
    title: `第 ${i + 1} 页标题`,
    points: [],
    narration: "",
    captions: [`第 ${i + 1} 页字幕`],
    durationSec: 4,
  }) as unknown as StoryPage;

/**
 * 每次调用都生成全新函数身份，模拟 App 里内联箭头回调的场景：
 * 父组件每重渲染一次，子组件拿到的 props 就是一套新函数。
 */
const makeProps = (over: Record<string, unknown> = {}) => ({
  taskId: "task_test",
  pages: [] as StoryPage[],
  done: false,
  tokens: "",
  stage: "plan",
  onPagesChange: vi.fn(),
  onDoneChange: vi.fn(),
  onTokensChange: vi.fn(),
  onStageChange: vi.fn(),
  onBack: () => {},
  onConfirm: () => {},
  focusPage: null as number | null,
  onFocusPageHandled: vi.fn(),
  ...over,
});

beforeEach(() => {
  subscribeStoryboard.mockReset();
  subscribeStoryboard.mockReturnValue(() => {});
  getTask.mockReset();
  // 永不 resolve：本文件不关心「补拉历史任务」，避免测试结束后的异步 setState
  getTask.mockReturnValue(new Promise(() => {}));
  regeneratePage.mockReset();
});

describe("StoryboardPreview SSE 订阅生命周期", () => {
  test("回归：父组件反复重渲染并传入新回调，SSE 也只订阅一次", () => {
    const { rerender } = render(<StoryboardPreview {...makeProps()} />);
    expect(subscribeStoryboard).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) {
      // 全新回调身份 + 新的 pages 数组
      rerender(<StoryboardPreview {...makeProps()} />);
    }

    // 若按 exhaustive-deps 建议把回调写进依赖，这里会变成 4 次，流式 token 会断
    expect(subscribeStoryboard).toHaveBeenCalledTimes(1);
  });

  test("回归：流式回调始终打到最新的父组件回调上（不读旧闭包）", () => {
    const first = makeProps();
    const { rerender } = render(<StoryboardPreview {...first} />);
    const second = makeProps();
    rerender(<StoryboardPreview {...second} />);

    // 模拟 SSE：先进入第 1 页的区段，再推一个 token
    act(() => {
      cb(7)("第 1 页展开"); // onSection
      cb(4)("正文 token"); // onToken
    });

    // 挂载时只被调用过一次（清空 tokens），之后再没有拿到任何内容
    expect(first.onTokensChange).toHaveBeenCalledTimes(1);
    expect(first.onTokensChange).toHaveBeenCalledWith("");

    // 流式内容全部落到最新回调上
    expect(second.onTokensChange).toHaveBeenCalled();
    const calls = second.onTokensChange.mock.calls;
    const latest = calls[calls.length - 1]?.[0] as string;
    expect(latest).toContain("正文 token");
    expect(latest).toContain("第 1 页展开");
  });

  test("新页面通过 SSE 推送时追加进列表，重复推送同一页不会重复插入", () => {
    const props = makeProps();
    render(<StoryboardPreview {...props} />);

    const p0 = makePage(0);
    act(() => {
      cb(1)(p0); // onPage
    });
    expect(props.onPagesChange).toHaveBeenCalledTimes(1);

    // onPagesChange 拿到的是函数式更新，直接验证去重语义
    const updater = props.onPagesChange.mock.calls[0][0] as (prev: StoryPage[]) => StoryPage[];
    const existing = [p0];
    expect(updater(existing)).toBe(existing);
    expect(updater([])).toEqual([p0]);
  });

  test("卸载时会关闭订阅", () => {
    const close = vi.fn();
    subscribeStoryboard.mockReturnValue(close);
    const { unmount } = render(<StoryboardPreview {...makeProps()} />);

    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("StoryboardPreview 定位到指定页", () => {
  test("回归：滚动 + 高亮生效，高亮结束后才回调一次 onFocusPageHandled", () => {
    vi.useFakeTimers();
    try {
      const onFocusPageHandled = vi.fn();
      const { container, rerender } = render(
        <StoryboardPreview {...makeProps({ pages: [makePage(0), makePage(1)], focusPage: 2, onFocusPageHandled })} />,
      );

      const cards = () => [...container.querySelectorAll(".dsh-sb-page")];
      expect(cards()).toHaveLength(2);
      // 高亮立刻打在第 2 页上（focusPage 是 1 基）
      expect(cards()[1].className).toContain("highlight");
      // 此时还没结束，不能提前通知父组件（提前通知会让父组件清掉 focusPage，动画被打断）
      expect(onFocusPageHandled).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(cards()[1].className).not.toContain("highlight");
      expect(onFocusPageHandled).toHaveBeenCalledTimes(1);

      // 父组件据此清空 focusPage 后，不应再被调用
      rerender(
        <StoryboardPreview
          {...makeProps({ pages: [makePage(0), makePage(1)], focusPage: null, onFocusPageHandled })}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onFocusPageHandled).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("focusPage 为空时不滚动也不回调", () => {
    const onFocusPageHandled = vi.fn();
    render(<StoryboardPreview {...makeProps({ pages: [makePage(0)], onFocusPageHandled })} />);

    expect(onFocusPageHandled).not.toHaveBeenCalled();
    expect(screen.getByText("第 1 页标题")).toBeInTheDocument();
  });
});
