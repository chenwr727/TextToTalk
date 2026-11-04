import { useEffect, type RefObject } from "react";
import { useCurrentFrame } from "remotion";
import type { BodyGeometry } from "./bodyGeometry";
import type { ElementBox, ElementGeometryPayload } from "./elementGeometry";

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

/** 会裁掉子内容的 overflow 取值（`visible` 不裁，文字溢出到邻居身上属于重叠问题） */
const CS_CLIP = new Set(["hidden", "clip", "auto", "scroll"]);

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
      /*
       * 元素级盒子（`TTT_ELEMENTS`）：与下面「正文块」用同一套过滤，但**逐个**记下来，
       * 交给 Node 侧判断裁字 / 压扁 / 重叠 / 越带。上限 120 个，超出只取前 120 个
       * （正常页面 10~40 个；真超了说明这一页元素过多，报错也会先被别的判据拦下）。
       */
      const boxes: ElementBox[] = [];
      const MAX_BOXES = 120;
      const pushBox = (el: HTMLElement, r: DOMRect, pos: string) => {
        if (boxes.length >= MAX_BOXES) return;
        const cs = getComputedStyle(el);
        const fontRaw = Number.parseFloat(cs.fontSize);
        boxes.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24),
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
          fontSize: Number.isFinite(fontRaw) ? Math.round(fontRaw) : 0,
          scrollW: el.scrollWidth,
          scrollH: el.scrollHeight,
          clientW: el.clientWidth,
          clientH: el.clientHeight,
          abs: pos === "absolute" || pos === "fixed",
          clip: CS_CLIP.has(cs.overflowX) || CS_CLIP.has(cs.overflowY) || (cs.overflow ?? "").includes("hidden"),
        });
      };
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        if (el.closest('[data-role="heading"]')) continue;
        /*
         * 标题容器（heading 的祖先）也不能算：two_column / three_card 这类场景把
         * 整页内容（含标题）包在一个静态竖列里，它的 box 从标题顶部开始。
         * 实测：不排除时 three_card 量出 bodyTop=90（就是标题上沿）。
         */
        if (heading && el.contains(heading)) continue;
        /*
         * 装饰图形要显式标记（`data-role="decor"`）。
         *
         * 实测：节段页那三圈装饰同心圆 `<circle>` 是 `position: static`、
         * 宽高也没超画布，于是越过了“绝对定位才需要是文字块”那条过滤，
         * 直接把正文框撑到 152..928（真正的文字在 451..700）。
         * 也试过“一律排除 svg 里面的元素”：图表、地图、custom_svg 的正文就是 svg 里的图元，
         * 排除后这三类页直接没几何（实测 3/30 页 n/a）。所以只认显式标记。
         */
        if (el.closest('[data-role="decor"]')) continue;
        const pos = getComputedStyle(el).position;
        const r = rectOf(el);
        if (pos === "absolute" || pos === "fixed") {
          if (!isTextLeafBlock(el)) continue;
          if (r.width * r.height < minAbsArea) continue;
        }
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.height > vh * 0.9) continue;
        if (r.width > vw * 0.9 && r.height > vh * 0.9) continue;
        /*
         * 只记「有意义的块」：带文字的，或者面积够大的容器（卡片底）。
         * 纯装饰的空白 div 记进来只会让重叠判据噪声爆炸。
         */
        if ((el.textContent ?? "").trim() || r.width * r.height >= minAbsArea * 4) pushBox(el, r, pos);
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
      const elementPayload: ElementGeometryPayload = {
        frame,
        pageIndex,
        boxes,
        expect: (() => {
          const raw = Number.parseInt(root.getAttribute("data-expect") ?? "", 10);
          return Number.isFinite(raw) ? raw : null;
        })(),
      };
      console.log(`TTT_ELEMENTS ${JSON.stringify(elementPayload)}`);
    }, 0);
    return () => clearTimeout(t);
  }, [frame, pageIndex, sceneRef]);
  return null;
};
