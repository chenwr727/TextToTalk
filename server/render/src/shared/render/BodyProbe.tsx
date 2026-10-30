import { useEffect, type RefObject } from "react";
import { useCurrentFrame } from "remotion";
import type { BodyGeometry } from "./bodyGeometry";

/**
 * 把「正文块的真实几何」报回 Node 侧。
 *
 * 为什么需要它：像素体检分不清「卡片顶在标题下、卡内文字偏下」和「整块内容浮在画布中间」——
 * 前者第一处深色墨迹在 y=410、后者在 y=480，可两张图的墨迹口径都是 200px 空洞。
 *
 * **关键坑（量了一整轮才定位）**：renderStill 里画布是**分两步**就位的。
 * 在 `useEffect` 里量，舞台还是 `0×0`、挂在 `top: -999999` 上（实测 `getBoundingClientRect().height = 0`、
 * 标题按 1 列折行量出 461px 高），量出来的坐标与截图完全对不上；
 * 只要让出一个宏任务（`setTimeout(…, 0)`），舞台就是 `1920×1080 @ top 0`，几何立刻与截图一致。
 * 所以这里**不能在 effect 里直接量**，必须延迟一拍。
 *
 * 另一个坑：`frame` 是**页内帧号**（探针挂在每页的 Sequence 里），不是整片帧号，
 * Node 侧要用同样口径做减法才对得上同一帧的截图。
 *
 * 输出：`TTT_BODY {json}` 一行一条（与 DomProbe 的 `TTT_PROBE` 同一套约定）。
 */
const rectOf = (el: Element) => el.getBoundingClientRect();

export const BodyProbe: React.FC<{
  pageIndex: number;
  sceneRef: RefObject<HTMLDivElement | null>;
}> = ({ pageIndex, sceneRef }) => {
  const frame = useCurrentFrame();
  useEffect(() => {
    // 让出一拍，等 Remotion 把舞台尺寸/位置写好（见文件头注释）
    const t = setTimeout(() => {
      const root = sceneRef.current;
      if (!root) return;
      const heading = root.querySelector<HTMLElement>('[data-role="heading"]');
      const caption = document.querySelector<HTMLElement>('[data-role="caption"]');

      /*
       * 正文块 = 场景里「在文档流中」元素的并集，两类要排除：
       * 1. 标题（绝对定位、不占文档流）与绝对定位的装饰（背景光环、大色块）；
       * 2. **铺满整页的布局骨架**：每个场景外都有一层 `flex: 1` 的容器，
       *    它的 box 是 0..1080，直接算并集会得到“正文从 0 开始”这种废话。
       *    实测：不排除时 points 页量出 bodyTop=0 / bodyBottom=1080。
       */
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      /*
       * 继承文字的绝对定位块要算进正文（第三层过滤）。
       *
       * title/section/end 这三类页面的内容全是绝对定位的，不放宽就永远拿不到几何（实测 3/30 页 n/a）；
       * custom_svg 的要点贴片、code 页自带的统计卡也是绝对定位的，不算进去会把“页面用了多少空间”量小。
       * 但绝对定位里也混着装饰（光环、大色块、右下角水印「设计评审」），所以只收两种：
       * 自己直接带文字的、且面积占画布 ≥ 0.25%（水印实测 2800px²，只占 0.13%，被排除）。
       */
      const ABS_MIN_AREA_RATIO = 0.0025;
      const minAbsArea = vw * vh * ABS_MIN_AREA_RATIO;
      /*
       * 只收「最内层文字块」：自己含文字、且没有子元素再含文字。
       * 否则 section 页那个包着标题的光环容器（绝对定位 + textContent 非空）会进来，
       * 量出 152..928 这种把装饰也算进去的框。
       */
      const isTextLeafBlock = (el: HTMLElement): boolean => {
        if (!(el.textContent ?? "").trim()) return false;
        return !Array.from(el.children).some((c) => (c.textContent ?? "").trim());
      };
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        if (el.closest('[data-role="heading"]')) continue;
        /*
         * 标题容器（heading 的祖先）也不能算：two_column / three_card 这类场景把
         * 整页内容（含标题）包在一个静态竖列里，它的 box 从标题顶部开始。
         * 实测：不排除时 three_card 量出 bodyTop=90（就是标题上沿）。
         */
        if (heading && el.contains(heading)) continue;
        const pos = getComputedStyle(el).position;
        const r = rectOf(el);
        if (pos === "absolute" || pos === "fixed") {
          if (!isTextLeafBlock(el)) continue;
          if (r.width * r.height < minAbsArea) continue;
        }
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.height > vh * 0.9) continue;
        if (r.width > vw * 0.9 && r.height > vh * 0.9) continue;
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      const payload: BodyGeometry = {
        frame,
        pageIndex,
        headingBottom: heading ? Math.round(rectOf(heading).bottom) : null,
        captionTop: caption ? Math.round(rectOf(caption).top) : null,
        bodyTop: Number.isFinite(top) ? Math.round(top) : null,
        bodyBottom: Number.isFinite(bottom) ? Math.round(bottom) : null,
        viewportH: window.innerHeight,
      };
      console.log(`TTT_BODY ${JSON.stringify(payload)}`);
    }, 0);
    return () => clearTimeout(t);
  }, [frame, pageIndex, sceneRef]);
  return null;
};
