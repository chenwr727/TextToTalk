import type { StoryPage } from "./props";

/**
 * 这一页**应该**画出几个内容块。
 *
 * 为什么需要它：元素级体检能发现"盒子被压扁/被裁/重叠"，但发现不了**元素压根没渲染**——
 * DOM 里没有盒子，就没有东西可比。实测代价：横屏地图页的地标卡片整块没渲染时，
 * 像素体检报 72% / 0 告警，元素体检也 0 告警，只有人眼看图才发现"卡片不见了"。
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

/** 片段取前 6 字：场景常有省略号/截断，取整句会大面积假阳性 */
const SNIPPET = 6;

const head = (s: string): string => Array.from(s.replace(/\s+/g, "").trim()).slice(0, SNIPPET).join("");

/**
 * 数据里应该出现在页面上的关键文案。
 *
 * `expectedBlocks` 只数"有几块"——数量对了，内容仍可能不对（某条文案根本没画，
 * 或被替换成了另一条）。这里给出**可逐字核对**的片段，由 `auditContent` 去页面上找。
 */
export function expectedTexts(page: StoryPage): string[] {
  const layout = String(page.layout ?? "");
  const out: string[] = [];
  const push = (s: unknown) => {
    if (typeof s !== "string") return;
    const h = head(s);
    if (h.length >= 3) out.push(h);
  };
  if (layout.startsWith("chart")) return out;
  if (layout === "title" || layout === "section" || layout === "end" || layout === "code") return out;
  if (layout === "table") {
    for (const r of page.table?.rows ?? []) {
      const row = r as unknown;
      const cells = Array.isArray(row) ? row : ((row as { cells?: unknown[] })?.cells ?? []);
      for (const c of cells) push(typeof c === "string" ? c : (c as { text?: string })?.text);
    }
    return out;
  }
  if (layout === "map") {
    for (const m of page.map?.markers ?? []) {
      const mk = m as { label?: string; name?: string; text?: string };
      push(mk.label ?? mk.name ?? mk.text);
    }
    return out;
  }
  // 要点列表 / 问答：每条要点都该出现
  for (const p of page.points ?? []) push((p as { text?: string })?.text);
  return out;
}
