import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { GeneratedPage } from "../../../server/render/src/shared/render/code/GeneratedPage";
import { ResponsiveContext } from "../../../server/render/src/shared/render/responsive";
import type { StoryPage } from "../../../server/render/src/shared/render/props";

/**
 * 生成式版式（`code`）的执行端。
 *
 * 这里不测"AI 写的页面好不好看"——那要靠 gallery 出图看。测的是**契约**：
 * 生成组件能不能拿到版式信息、拿不到/跑挂了会不会降级。
 *
 * 背景：契约原本只写了"画布 1920×1080"，生成代码因此按横屏写死横向排布，
 * 竖屏（可用宽 952）下三张统计卡溢出、左右两张被裁。现在 props 里多了
 * portrait / width / height，这里盯住它真的被传下去了。
 */

/** 造一段"转译后"的生成代码：与生产一致（CommonJS + exports.default） */
const seenProps = (key: string) =>
  [
    '"use strict";',
    'Object.defineProperty(exports, "__esModule", { value: true });',
    "exports.default = function Page(props) {",
    `  globalThis.${key} = { portrait: props.portrait, width: props.width, height: props.height };`,
    "  return null;",
    "};",
  ].join("\n");

const readSeen = (key: string) =>
  (globalThis as unknown as Record<string, { portrait?: boolean; width?: number; height?: number }>)[key];

const page = (code: string): StoryPage =>
  ({
    pageIndex: 0,
    layout: "code",
    title: "一条审批为什么要走 11 道",
    points: ["把审批链路拆开看", "等待占了八成时间", "决策点前移到一线"],
    narration: "",
    captions: [],
    chart: null,
    durationSec: 8,
    accent: 0,
    code,
  }) as StoryPage;

const renderAt = (code: string, width: number, height: number) =>
  render(
    <ResponsiveContext.Provider value={{ width, height }}>
      <GeneratedPage page={page(code)} fps={30} subtitles={false} isFirst={false} />
    </ResponsiveContext.Provider>,
  );

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).__seenPortrait;
  delete (globalThis as unknown as Record<string, unknown>).__seenLandscape;
});

describe("GeneratedPage 的版式契约", () => {
  it("竖屏时把 portrait=true 与画布尺寸透传下去", () => {
    renderAt(seenProps("__seenPortrait"), 1080, 1920);
    expect(readSeen("__seenPortrait")).toEqual({ portrait: true, width: 1080, height: 1920 });
  });

  it("横屏时 portrait=false", () => {
    renderAt(seenProps("__seenLandscape"), 1920, 1080);
    expect(readSeen("__seenLandscape")).toEqual({ portrait: false, width: 1920, height: 1080 });
  });
});

describe("生成代码跑挂时的降级", () => {
  it("语法错误 → 降级成 points，页面照常出", () => {
    const { container } = renderAt("export default function (", 1920, 1080);
    expect(container.textContent).toContain("把审批链路拆开看");
  });

  it("渲染期抛异常 → 错误边界兜住并降级", () => {
    // React 会把这个异常打到 console.error，这里只是为了让测试输出干净
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = [
        '"use strict";',
        'Object.defineProperty(exports, "__esModule", { value: true });',
        'exports.default = function Page() { throw new Error("boom"); };',
      ].join("\n");
      const { container } = renderAt(code, 1920, 1080);
      expect(container.textContent).toContain("把审批链路拆开看");
    } finally {
      quiet.mockRestore();
    }
  });
});
