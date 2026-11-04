import type { ElementBox } from "../../render/src/shared/render/elementGeometry";

/**
 * 元素级体检：补上像素口径看不见的四类问题。
 *
 * 背景：像素体检（`measureInk`）只能回答"哪里有深色像素"，于是两个真 bug 都是靠人眼看图发现的：
 * - 四象限页的胶囊盖在大字上（体检 93% fill、0 告警）；
 * - 横屏地图页的地标卡片被压到 17px 高、看起来像"卡片不见了"（体检 72%、0 告警）。
 *
 * 判据只用渲染端报回来的 DOM 真值，不看像素：
 * 1. **裁字**：`scrollHeight/clientHeight` 不等 → 文字被容器裁掉（最常见的是"看着少了一行"）；
 * 2. **压扁**：块高比自己的字号还小 → 一行字都放不下（地图卡片被压到 17px 就是这类）；
 * 3. **重叠**：两个块面积重叠超过较小者的 35%，且互不包含 → 一块盖住另一块；
 * 4. **越界**：块越过正文带底，或压到字幕上沿 → 观众会看到字被字幕条挡住。
 *
 * 刻意的例外：
 * - 绝对定位的块之间**允许**重叠（贴片、角标、地图上的地名是设计如此），只在绝对块压住
 *   **流内**块时才报；纯绝对块之间的重叠报 info。
 * - 包含关系（父容器与其子元素）不算重叠。
 */

export interface ElementFinding {
  level: "warn" | "info";
  message: string;
}

export interface ElementAuditOptions {
  /** 画布宽高 */
  width: number;
  height: number;
  /** 正文带上下沿（与像素体检同一口径） */
  bandTop: number;
  bandBottom: number;
  /** 字幕条上沿；为 null 表示这一页没有字幕 */
  captionTop?: number | null;
}

/** 面积重叠比超过它才算"盖住了"，留出圆角/描边接触的余量 */
const OVERLAP_RATIO = 0.35;
/** 块高不足字号的这个倍数，就认为被压扁了（正文行高通常 ≥1.2） */
const SQUASH_RATIO = 1.05;
/** 越界的容差：字体渲染有 1~2px 出入 */
const EDGE_TOLERANCE = 8;
/**
 * 裁字容差：行盒取整、字体行距都会带来几像素差异。
 * 不设容差时整屏都是「高 36 < 内容 40」这种 4px 取整差（实测把 21/30 页全报成告警）；
 * 真裁掉一行至少是半个行高。
 */
const CLIP_TOLERANCE_RATIO = 0.6;
/** SVG 图元与画在它上面的文字是画图的本意（柱子上的数字、地图上的地名），不参与重叠判据 */
const SVG_TAGS = new Set([
  "svg",
  "g",
  "path",
  "polygon",
  "polyline",
  "circle",
  "ellipse",
  "rect",
  "line",
  "text",
  "tspan",
  "use",
  "defs",
  "mask",
]);

const overlapArea = (a: ElementBox, b: ElementBox): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** a 是否包含 b（含 1px 容差） */
const contains = (a: ElementBox, b: ElementBox): boolean =>
  a.x - 1 <= b.x && a.y - 1 <= b.y && a.x + a.w + 1 >= b.x + b.w && a.y + a.h + 1 >= b.y + b.h;

const brief = (b: ElementBox): string => (b.text ? `「${b.text}」` : `<${b.tag}>`);

/**
 * 最内层文字块：自己有文字，且**没有含文字的子孙**（与 `BodyProbe` 的 `isTextLeafBlock` 同义）。
 *
 * 不能用"不含任何别的盒子"：卡片容器 `<div>1产品 · 上海</div>` 与它内部的名字 div 互为包含，
 * 于是两边都被判成非叶子——实测横屏地图明明有 3 张卡，却数出 0 个文字块（误报）。
 *
 * **排除 SVG 内部文字**：地名、图表数值都是 `<text>`，数量与"数据有几条内容"无关；
 * 不排除时，3 个地名 + 1 个图例就能把数量凑够，判据形同虚设。
 */
const leafTextBoxes = (boxes: ElementBox[]): ElementBox[] =>
  boxes.filter((b) => {
    if (SVG_TAGS.has(b.tag)) return false;
    if (!b.text || b.text.length < 2) return false;
    /*
     * 只认「严格更小」的含文字子盒：同一矩形上常套着两层 div（`fs 16` 的容器与
     * `fs 34` 的字号层），它们互为包含；按"包含"判会把两层同时排除，
     * 实测横屏地图明明有 3 张卡却数出 0 个文字块。
     */
    const area = b.w * b.h;
    return !boxes.some((other) => other !== b && other.text && other.w * other.h < area && contains(b, other));
  });

/**
 * 元素**在不在**：数据里有 N 条，页面上就该有 N 个内容块。
 *
 * 这是元素级判据唯一的盲区——没有盒子就没有东西可比。实测：横屏地图页地标卡片
 * 整块没渲染时，像素体检 72% / 0 告警、元素体检也 0 告警，只有人眼看图才发现。
 *
 * 判据只用"叶子文字块"的个数，容忍多（图表标签、图例、地名都会计入），
 * 只在**明显少于**预期时报警——少一个就可能意味着整张卡没画出来。
 */
export function auditPresence(boxes: ElementBox[], expect: number | null | undefined, note?: string): ElementFinding[] {
  if (expect == null || expect <= 0) return [];
  // 单块内容（封面/图表/生成式）不做数量判据：它们本来就没有"条数"可比
  if (expect < 2) return [];
  const observed = leafTextBoxes(boxes).length;
  if (observed >= expect) return [];
  return [
    {
      level: "warn",
      message: `元素缺失：数据里有 ${expect} 条内容，页面上只找到 ${observed} 个文字块${note ? `（${note}）` : ""}`,
    },
  ];
}

/**
 * 内容**对不对**：数据里这条文案，页面上到底有没有画出来。
 *
 * `auditPresence` 只数块数——数量对了，内容仍可能不对（这条没画、或画成了另一条）。
 * 这里拿数据里的片段逐条去页面上找（归一化空白后做包含匹配），找不到就报。
 *
 * 只核对片段（前 6 字），容忍省略号与截断；代价是"前 6 字对、后半句错"仍看不出来。
 */
/**
 * 归一化文本，用来比对"数据里的文案有没有画出来"。
 *
 * 渲染层会**重排和格式化**文案，逐字匹配天然误报，实测三种：
 * - `table-numeric`：数据 `12000元` → 页面 `12,000元`（加了千分位）
 * - `stats`：数据 `审批时长 1.5 天` → 页面拆成 `1.5` + `审批时长 天`（数值与标签换位）
 * - `points-quadrant`：数据 `高频高痛：报销` → 页面 `高频高痛` + `报销`（去掉冒号）
 *
 * 所以：去空白与标点、数字去千分位，再比对。
 */
const norm = (s: string): string =>
  s
    .replace(/\s+/g, "")
    .replace(/[：:、，,。.；;·+＋]/g, "")
    .replace(/(\d),(?=\d{3})/g, "$1");

/** 按非字母数字汉字切成 token，用于"顺序包含"匹配（容忍渲染层换位） */
const tokens = (s: string): string[] =>
  norm(s)
    .split(/(?<!\d)(?=\d)|[^\p{L}\p{N}.%]/u)
    .filter(Boolean);

export function auditContent(boxes: ElementBox[], expectTexts: readonly string[] | null | undefined): ElementFinding[] {
  if (!expectTexts || expectTexts.length === 0) return [];
  const hay = norm(boxes.map((b) => b.text ?? "").join(""));
  /*
   * 每个片段拆成 token 后**逐个**检查是否出现，而不是要求整段连续出现。
   *
   * 原因见 `norm` 的注释：渲染层会重排（数值与标签换位）、去标点、加千分位。
   * 要求连续会把这三类正常渲染全部报成"文案没画出来"。
   */
  const missing = expectTexts.filter((t) => {
    const ts = tokens(t);
    if (ts.length === 0) return false;
    return !ts.every((tok) => hay.includes(tok));
  });
  if (missing.length === 0) return [];
  const shown = missing
    .slice(0, 3)
    .map((t) => `「${t}」`)
    .join("");
  return [
    {
      level: "warn",
      message: `文案没画出来：${missing.length} 条数据在页面上找不到 ${shown}${missing.length > 3 ? " 等" : ""}`,
    },
  ];
}

export function auditElements(boxes: ElementBox[], opts: ElementAuditOptions): ElementFinding[] {
  const out: ElementFinding[] = [];
  if (!boxes.length) return out;
  const { bandTop, bandBottom, captionTop } = opts;

  for (const b of boxes) {
    // 1. 裁字：内容比盒子大、且盒子真的会裁（overflow 不是 visible）
    const tol = Math.max(6, b.fontSize * CLIP_TOLERANCE_RATIO);
    const clippedY = b.clip && b.clientH > 0 && b.scrollH > b.clientH + tol;
    const clippedX = b.clip && b.clientW > 0 && b.scrollW > b.clientW + tol;
    if (clippedY || clippedX) {
      const dir = clippedY ? `高 ${b.clientH} < 内容 ${b.scrollH}` : `宽 ${b.clientW} < 内容 ${b.scrollW}`;
      out.push({
        level: "warn",
        message: `文字被裁：${brief(b)} 盒子 ${dir}（y=${b.y}）`,
      });
    }

    /*
     * 2. 压扁：盒子比自己的字号还矮，且会裁 → 一行都放不下。
     *
     * 只看正文块（≥4 字）：引用号「“」这种单字符装饰字本来就不占满 em 框。
     * 不要求 clip 时会把 map 图例（13px 行盒）这类正常元素也当成压扁。
     */
    if (b.clip && b.fontSize > 0 && b.h > 0 && b.text.length >= 4 && b.h < b.fontSize * SQUASH_RATIO) {
      out.push({
        level: "warn",
        message: `块被压扁：${brief(b)} 高 ${b.h}px < 字号 ${b.fontSize}px（y=${b.y}）`,
      });
    }

    // 4. 越界：越过正文带底 / 压到字幕
    const bottomLimit = captionTop != null ? Math.min(bandBottom, captionTop) : bandBottom;
    if (b.y + b.h > bottomLimit + EDGE_TOLERANCE) {
      out.push({
        level: "warn",
        message: `内容越过下边界：${brief(b)} 底 ${b.y + b.h} > ${bottomLimit}（y=${b.y}）`,
      });
    }
    if (b.y < bandTop - EDGE_TOLERANCE && !b.abs) {
      out.push({
        level: "info",
        message: `内容起点高于正文带顶：${brief(b)} y=${b.y} < ${bandTop}`,
      });
    }
  }

  // 3. 重叠：两两比较（盒子数量上限 120，最坏 7140 次，够快）
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (contains(a, b) || contains(b, a)) continue;
      // SVG 图元不参与：柱上数字、地图地名都是画在图形上的
      if (SVG_TAGS.has(a.tag) || SVG_TAGS.has(b.tag)) continue;
      /*
       * 父容器与子元素的免检：一个的文字包含另一个，说明是同一块内容的外层。
       * 不能只靠 contains —— 子元素溢出父容器时矩形不再包含，但那是"裁字"，不是"盖住"。
       */
      if (a.text && b.text && (a.text.includes(b.text) || b.text.includes(a.text))) continue;
      /*
       * 容器吸收子元素：大块把小块整个罩住、且面积是小块的 2 倍以上 → 外层容器与格内文字。
       * 文字包含判断在「容器文字被截断到 24 字」时会失效（表格外层的 textContent 是拼接串），
       * 所以再补一条纯几何判据。
       */
      const big = a.w * a.h >= b.w * b.h ? a : b;
      const small = big === a ? b : a;
      if (big.w * big.h >= small.w * small.h * 2) {
        const cx = small.x + small.w / 2;
        const cy = small.y + small.h / 2;
        if (cx >= big.x && cx <= big.x + big.w && cy >= big.y && cy <= big.y + big.h) continue;
      }
      const area = overlapArea(a, b);
      if (area <= 0) continue;
      const smaller = Math.min(a.w * a.h, b.w * b.h);
      if (smaller <= 0) continue;
      const ratio = area / smaller;
      if (ratio <= OVERLAP_RATIO) continue;
      // 绝对定位块之间允许叠放（贴片、角标）；压住流内块才报
      const bothAbs = a.abs && b.abs;
      out.push({
        level: bothAbs ? "info" : "warn",
        message: bothAbs
          ? `两块绝对定位元素重叠 ${Math.round(ratio * 100)}%：${brief(a)} 与 ${brief(b)}`
          : `两块内容重叠 ${Math.round(ratio * 100)}%：${brief(a)} 与 ${brief(b)}`,
      });
    }
  }

  return out;
}
