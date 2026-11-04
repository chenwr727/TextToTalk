/**
 * 元素级几何：渲染端把「每个内容元素」的盒子报回来，让体检能看见
 * **元素被裁、被压扁、互相重叠、越过正文带**这几类问题。
 *
 * 为什么需要它（两轮实测都是靠人眼看图才发现的）：
 * - 四象限页的胶囊盖在大字上，体检报 93% fill / 0 告警；
 * - 横屏地图页的地标卡片被压到 17px 高（看起来像"卡片不见了"），体检报 72% / 0 告警。
 *
 * 像素口径（`measureInk`）本质上只能回答"哪里有深色像素"，回答不了"两个块是否叠在一起"。
 */
export interface ElementBox {
  /** 元素标签名的小写形式，用于报错时定位 */
  tag: string;
  /** 该元素文字的前 24 字（去掉空白），没文字时为空串 */
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 计算后的字号（px）；拿不到时为 0 */
  fontSize: number;
  /** 内容真实尺寸 vs 盒子尺寸：不等就说明被裁了 */
  scrollW: number;
  scrollH: number;
  clientW: number;
  clientH: number;
  /** 是否是绝对/固定定位（绝对定位的块可能是有意叠放的贴片） */
  abs: boolean;
  /**
   * 是否真的会裁掉内容（overflow 不是 visible）。
   *
   * 只有会裁的盒子才可能"裁字"：`overflow: visible` 的盒子即使内容比它大，
   * 文字也只是溢出到外面（那是重叠问题），观众照样看得见。
   * 不加这一条时会报出大量假裁字（实测 qa 的 96 < 106、map 图例的 13 < 26 都是这类）。
   */
  clip: boolean;
}

export interface ElementGeometryPayload {
  frame: number;
  pageIndex: number;
  boxes: ElementBox[];
}
