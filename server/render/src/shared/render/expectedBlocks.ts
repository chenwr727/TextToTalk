import type { StoryPage } from "./props";

/**
 * 这一页**应该**画出几个内容块。
 *
 * 为什么需要它：元素级体检能发现"盒子被压扁/被裁/重叠"，但发现不了**元素压根没渲染**——
 * DOM 里没有盒子，就没有东西可比。实测代价：横屏地图页的地标卡片整块没渲染时，
 * 像素体检报 72% / 0 告警，元素体检也报 0 告警，只有人眼看图才发现"卡片不见了"。
 *
 * 这里按版式的数据形状给出预期块数（数据里有几条就该画几块，**不涉及样式**），
 * 探针把它原样回传，`auditPresence` 拿"实际叶子文字块数"去比。
 */
export function expectedBlocks(page: StoryPage): number {
  const layout = String(page.layout ?? "");
  const nPoints = Array.isArray(page.points) ? page.points.length : 0;
  // 图表、封面、隔断、收尾、生成式：整页就是"一块内容"
  if (layout.startsWith("chart")) return 1;
  if (layout === "title" || layout === "section" || layout === "end" || layout === "code") return 1;
  if (layout === "table") {
    const rows = page.table?.rows;
    return Array.isArray(rows) && rows.length ? rows.length : 1;
  }
  if (layout === "map") {
    const markers = page.map?.markers;
    return Array.isArray(markers) && markers.length ? markers.length : 1;
  }
  // 问答：问句 + 至少一个回答
  if (layout === "qa") return Math.max(2, nPoints);
  // 其余都是"要点列表"型：有几条画几张卡
  return Math.max(1, nPoints);
}
