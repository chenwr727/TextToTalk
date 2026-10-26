import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom 没有实现 scrollIntoView，而 StoryboardPreview 的定位逻辑会真实调用它
Element.prototype.scrollIntoView = () => {};

// 组件用 alert 报接口错误，jsdom 默认会打印 "Not implemented"
window.alert = () => {};

// 关闭了 vitest globals，RTL 的自动 cleanup 不会生效，这里手动挂上，
// 否则上一个用例渲染的 DOM 会残留，导致 getByText 命中多个元素
afterEach(() => {
  cleanup();
});
