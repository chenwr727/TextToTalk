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
  for (const p of page.points ?? []) collect(pointTextOf(p));
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
 * 表格行与要点列表都做，判据相同：一条数据 = 一个块。
 * 要点用**首部片段**当标签（要点是自由文本，没有独立的标签字段）。
 */
export function expectedPairs(page: StoryPage): { label: string; value: string }[] {
  const layout = String(page.layout ?? "");
  const out: { label: string; value: string }[] = [];
  const numsOf = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
  if (layout === "table") {
    for (const r of page.table?.rows ?? []) {
      const row = r as unknown;
      const cells = (Array.isArray(row) ? row : ((row as { cells?: unknown[] })?.cells ?? [])).map((c) =>
        typeof c === "string" ? c : String((c as { text?: string })?.text ?? ""),
      );
      if (cells.length < 2) continue;
      const label = cells[0].trim();
      for (const cell of cells.slice(1)) {
        for (const n of numsOf(cell)) if (label) out.push({ label, value: n });
      }
    }
    return out;
  }
  if (layout === "map" || layout.startsWith("chart")) return out;
  if (layout === "title" || layout === "section" || layout === "end" || layout === "code") return out;
  /*
   * 要点列表：每条要点的首部片段与它自己的数字应该在同一块里。
   *
   * 只对**首部含数字**或**数字紧跟文字**的要点有意义；纯数字开头的序号（"1."）跳过，
   * 那种数字没有配对语义。
   */
  for (const p of page.points ?? []) {
    const text = pointTextOf(p);
    if (!text) continue;
    /*
     * 标签要**剥掉数字与符号**：页面上常把数值（连同正号/百分号）提到标签前面
     * （`审批时长 1.5 天` → `1.5` + `审批时长 天`；`满意度 +12 分` → `+12` + `满意度 分`）。
     * 拿原文开头当标签会带上数字，标签里残留一个 `+` 就会“找不到自己”。
     */
    const label = Array.from(
      text
        .replace(/\d+(?:\.\d+)?/g, "")
        .replace(/[+＋\-−%％]/g, "")
        .replace(/\s+/g, ""),
    )
      .slice(0, 4)
      .join("");
    if (label.length < 3) continue;
    for (const n of numsOf(text)) if (n.length >= 2) out.push({ label, value: n });
  }
  return out;
}

/** 片段取前 6 字：场景常有省略号/截断，取整句会大面积假阳性 */
const SNIPPET = 6;

/** 尾部片段取 4 字：比首部短一截，因为尾部更容易被省略号/单位渲染吃掉 */
const TAIL = 4;

/** 超过这个字数就不取尾部片段：长文案在页面上会被有意截断 */
const TAIL_MAX_CHARS = 12;

const head = (s: string): string => Array.from(s.replace(/\s+/g, "").trim()).slice(0, SNIPPET).join("");

/**
 * 尾部片段：抓"前半句对、后半句被改掉"。
 *
 * 只核首部时，`流程的价值不在管住人` 被渲染成 `流程的价值不在折腾人` 也照样通过
 * （前 6 字一样）。补上尾部后，两处都要对得上才算画对。
 *
 * 只在原文明显长于两段之和时才取尾部，否则首尾会重叠、白增一次重复检查。
 */
const tail = (s: string): string => {
  const chars = Array.from(s.replace(/\s+/g, "").trim());
  /*
   * 两道门槛必须留出一段**非空区间**：
   * 上界 12（长文案会被截断）、下界 10（首 6 + 尾 4 才不重叠）。
   * 曾经下界写成 12，于是只有“恰好 12 字”才取尾部——实际上死代码，
   * 对抗性验证时改了 11 字要点的末两字却没报警，就是这个原因。
   */
  if (chars.length < SNIPPET + TAIL) return "";
  /*
   * 只对**短文案**生效：长文案在页面上会被有意截断（省略号/裁剪）。
   *
   * 实测踩过：qa 的回答数据写到「…带来更有效」，页面只渲染到「把结果指」——
   * 裁剪是版面设计，不是错，拿尾部去核只会满屏假阳性。
   * 短文案不可能被截断，这时尾部才是可靠判据。
   */
  if (chars.length > TAIL_MAX_CHARS) return "";
  return chars.slice(-TAIL).join("");
};

/** `Point` 既能是纯字符串，也能是 `{ text }`——**字符串形态漏处理过一次**：整页内容核对静默失效 */
const pointTextOf = (p: unknown): string => {
  if (typeof p === "string") return p;
  const t = (p as { text?: unknown })?.text;
  return typeof t === "string" ? t : "";
};

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
    const t = tail(s);
    if (t) out.push(t);
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
  for (const p of page.points ?? []) push(pointTextOf(p));
  return out;
}
