import { useEffect } from "react";
import { useCurrentFrame } from "remotion";

/**
 * DOM 探针：把"这一帧真正渲染出来的布局"回传给 Node。
 *
 * 为什么需要它：Remotion 在无头 Chrome 里渲染，浏览器拿不到文件系统，画面只能看 PNG。
 * 于是布局类改动只能"改代码 → 重渲 → 肉眼看图/数像素"，一轮 1~3 分钟，而且经常看错
 * （真的踩过：以为竖屏表格只占一半宽，其实逐张看原图才发现是缩略图骗了眼睛）。
 *
 * 做法：把要看的元素（CSS 选择器）连同它到根节点的每一层"决定宽度的祖先"都导出来，
 * 由 run-render.mjs 的 onBrowserLog 落成文件。**只在 inputProps.probe 存在时才挂载**，
 * 正常出片路径完全不受影响。
 */

export interface ProbeSpec {
  /** 要测量的元素选择器，逐个导出匹配到的元素（最多 12 个） */
  selectors: string[];
  /** 是否连整页 HTML 一起导出（排查结构问题时用，体积较大） */
  html?: boolean;
  /** 按文字定位：找到"自己包含这段文字、但子元素都不包含"的那个叶子元素，再沿祖先链回溯 */
  text?: string;
}

/** 相邻祖先最多回溯几层：再往上都是版面容器，对"宽度为什么没生效"没有解释力 */
const MAX_DEPTH = 8;

const KEY_STYLES = [
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "flex",
  "flexBasis",
  "flexGrow",
  "alignSelf",
  "alignItems",
  "justifyContent",
  "boxSizing",
  "transform",
  "zoom",
] as const;

const describe = (el: Element) => {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const styles: Record<string, string> = {};
  for (const k of KEY_STYLES) styles[k] = cs[k as keyof CSSStyleDeclaration] as string;
  return {
    tag: el.tagName.toLowerCase(),
    // Remotion 会把非当前页的图层挪到屏幕外（top: -999999px），
    // 只看 on-screen 的实例才能对上"成图里那张卡"
    visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth,
    rect: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    styles,
    // 行内样式单独列出来：判断"写了但没生效"时必须能区分是行内被忽略，还是压根没写
    inline: (el as HTMLElement).getAttribute("style") ?? "",
  };
};

const chainOf = (el: Element) => {
  const chain: ReturnType<typeof describe>[] = [];
  let node: Element | null = el.parentElement;
  while (node && chain.length < MAX_DEPTH) {
    chain.push(describe(node));
    node = node.parentElement;
  }
  return chain;
};

export const DomProbe: React.FC<{ spec: ProbeSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const selectors = spec.selectors.join("\u0000");
  useEffect(() => {
    const textHits = (needle: string) =>
      Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
        if (!el.textContent || !el.textContent.includes(needle)) return false;
        // 只取最深的那个（子元素都不含这段文字的才算叶子），否则会命中 body/html
        return !Array.from(el.children).some((c) => c.textContent?.includes(needle));
      });
    const report: any[] = spec.text
      ? [
          {
            selector: `text:${spec.text}`,
            count: textHits(spec.text).length,
            items: textHits(spec.text)
              .slice(0, 12)
              .map((el) => ({ ...describe(el), chain: chainOf(el) })),
          },
        ]
      : [];
    report.push(...spec.selectors.map((sel) => {
      let nodes: Element[] = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel)).slice(0, 12);
      } catch (err) {
        return { selector: sel, error: `选择器无效: ${(err as Error).message}` };
      }
      return {
        selector: sel,
        count: nodes.length,
        items: nodes.map((el) => ({ ...describe(el), chain: chainOf(el) })),
      };
    }));
    const payload = {
      frame,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      report,
      html: spec.html ? document.body.innerHTML.slice(0, 400_000) : undefined,
    };
    // 前缀固定，Node 侧按前缀切出 JSON
    console.log(`TTT_PROBE ${JSON.stringify(payload)}`);
  }, [frame, selectors, spec.selectors, spec.html, spec.text]);
  return null;
};
