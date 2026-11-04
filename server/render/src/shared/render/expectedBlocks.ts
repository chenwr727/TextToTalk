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

/**
 * 数据里出现过的数字（含单位/百分号前的数值），用来核对"数字有没有被改或丢"。
 *
 * 只核对"出现过"，不核对位置与格式：渲染层会加千分位（`12000` → `12,000`）、
 * 拆成数值+单位两段，所以比对时也要做同样的归一化。
 */
export function expectedNumbers(page: StoryPage): string[] {
  const layout = String(page.layout ?? "");
  if (layout.startsWith("chart") || layout === "title" || layout === "section" || layout === "end") return [];
  if (layout === "code") return [];
  const raw: string[] = [];
  const collect = (s: unknown) => {
    if (typeof s !== "string") return;
    // 数字后可跟 % / 元 / 天 / 倍 等单位，一并取出（单位常被渲染层拆到另一个盒子）
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) raw.push(m[0]);
  };
  for (const p of page.points ?? []) collect((p as { text?: string })?.text);
  for (const m of page.map?.markers ?? []) {
    const mk = m as { label?: string; name?: string; text?: string };
    collect(mk.label ?? mk.name ?? mk.text);
  }
  for (const r of page.table?.rows ?? []) {
    const row = r as unknown;
    const cells = Array.isArray(row) ? row : ((row as { cells?: unknown[] })?.cells ?? []);
    for (const c of cells) collect(typeof c === "string" ? c : (c as { text?: string })?.text);
  }
  // 去重并保持顺序；纯序号（1、2、3）没有核对价值且容易与别处数字撞车
  return [...new Set(raw)].filter((n) => n.length >= 2 || /[.%]/.test(n) || Number(n) >= 10);
}

/** 这一页应该画出的图标 id（`IconView` 遇到不认识的 id 会静默不渲染） */
export function expectedIcons(page: StoryPage): string[] {
  const out: string[] = [];
  if (page.icon) out.push(String(page.icon));
  return out;
}
/**
 * 需要配对的「标签 + 数值」组（抓"数值张冠李戴"）。
 *
 * `expectedNumbers` 只核对数字还在不在，A 的数值画到 B 那一行照样通过。
 * 这里给出同一条数据里的标签与数值，由 `auditPairs` 核对它们是否在同一块里。
 *
 * 只做**表格**：表格的行列语义明确（一行里的首列是标签、其余列是数值），
 * 要点列表里"哪个数字配哪个词"没有可靠判据，硬做会大面积误报。
 */
export function expectedPairs(page: StoryPage): { label: string; value: string }[] {
  if (String(page.layout ?? "") !== "table") return [];
  const out: { label: string; value: string }[] = [];
  for (const r of page.table?.rows ?? []) {
    const row = r as unknown;
    const cells = (Array.isArray(row) ? row : ((row as { cells?: unknown[] })?.cells ?? [])).map((c) =>
      typeof c === "string" ? c : String((c as { text?: string })?.text ?? ""),
    );
    if (cells.length < 2) continue;
    const label = cells[0].trim();
    for (const cell of cells.slice(1)) {
      const nums = [...cell.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
      for (const n of nums) if (label) out.push({ label, value: n });
    }
  }
  return out;
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
