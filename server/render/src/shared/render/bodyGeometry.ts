/**
 * 渲染端回传的「正文块真实竖向几何」。
 *
 * 单独放 .ts（不放在 BodyProbe.tsx 里）：Node 侧 e2e/gallery 要用这个类型，
 * 而 server/tsconfig 没开 jsx，从 .tsx import 类型会报 TS6142。
 */
export interface BodyGeometry {
  /** 页内帧号（探针所在的 Sequence 内），不是整片帧号 */
  frame: number;
  pageIndex: number;
  /** 标题（data-role="heading"）下沿；这页没有标题时为 null */
  headingBottom: number | null;
  /** 字幕条（data-role="caption"）上沿；这页没有字幕时为 null */
  captionTop: number | null;
  /** 正文块上沿：场景里除标题外、在文档流中的元素的并集 */
  bodyTop: number | null;
  /** 正文块下沿 */
  bodyBottom: number | null;
  viewportH: number;
}
