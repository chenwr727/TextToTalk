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

/**
 * 数字**对不对**：数据里出现过的每个数字，页面上都该能找到。
 *
 * 文字片段核对看不出"数字被改掉"——`12000元` 变成 `1200元` 时前 6 字照样匹配。
 * 这里单独核对数字：归一化千分位后逐个在页面文本里找。
 *
 * 只核对"这个数还在不在"，不核对它跟谁配对——数字张冠李戴（A 的数值画到 B 上）仍看不出来。
 */
export function auditNumbers(
  boxes: ElementBox[],
  expectNumbers: readonly string[] | null | undefined,
): ElementFinding[] {
  if (!expectNumbers || expectNumbers.length === 0) return [];
  const hay = boxes.map((b) => (b.text ?? "").replace(/\s+/g, "").replace(/(\d),(?=\d{3})/g, "$1")).join("");
  const missing = expectNumbers.filter((n) => !hay.includes(n));
  if (missing.length === 0) return [];
  return [
    {
      level: "warn",
      message: `数字对不上：${missing.length} 个数据里的数字在页面上找不到（${missing.slice(0, 4).join("、")}）`,
    },
  ];
}

/**
 * 图标**在不在**：`IconView` 遇到不认识的 id 会静默返回 null。
 *
 * 页面上什么都不缺，只是图标不在，肉眼很容易当成"设计就是这样"。
 * 比对"数据声明的 id"与"实际渲染出来的 `data-icon`"。
 */
export function auditIcons(
  icons: readonly string[] | null | undefined,
  expectIcons: readonly string[] | null | undefined,
): ElementFinding[] {
  if (!expectIcons || expectIcons.length === 0) return [];
  const got = new Set((icons ?? []).filter(Boolean));
  const missing = expectIcons.filter((id) => !got.has(id));
  if (missing.length === 0) return [];
  return [
    {
      level: "warn",
      message: `图标对不上：数据声明了 ${missing.join("、")}，页面上没有它（id 不在 ICON_PATHS 里会静默不渲染，渲染成别的图标也会报）`,
    },
  ];
}

/**
 * 数字**有没有配错**：数值应该和它自己的标签在同一个块里。
 *
 * `auditNumbers` 只核对"这个数还在页面上"，所以 A 的数值画到 B 那一行照样通过
 * （表头顺序改了、行列错位都会这样）。这里核对**配对**。
 *
 * 判据：存在一个盒子同时含该标签与该数值，且**不含别的标签的数值**。
 *
 * 那半句是关键——页面上有一个包住全部的容器，它同时含所有标签和所有数值；
 * 若只要求"随便哪个盒子含就行"，那个大容器会让任何配对都通过（实测交换两条要点的
 * 数字后判据毫无反应）。
 *
 * 注意排除的是"**别的标签**的数值"，不是"别的数值"：表格一行的盒子本来就含该行
 * 多个数值（`自建 12,000元 3人 4个月` 是一个盒子），按后者排除会把这行判成不配对。
 *
 * 数值比对必须按**完整数字 token**，不能用子串包含：`12000` 里含 `1`、`38000` 里含 `3`，
 * 子串匹配会把本行自己的数当成"别人出现的数"（实测 9 组全部误报就是栽在这）。
 */
export function auditPairs(
  boxes: ElementBox[],
  pairs: readonly { label: string; value: string }[] | null | undefined,
): ElementFinding[] {
  if (!pairs || pairs.length === 0) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/(\d),(?=\d{3})/g, "$1");
  const texts = boxes.map((b) => norm(b.text ?? ""));
  /** 盒子里的完整数字集合（按数字边界切，`12000` 只算 `12000`） */
  const numsOf = (t: string): Set<string> => new Set(t.match(/\d+(?:\.\d+)?/g) ?? []);
  const boxNums = texts.map(numsOf);
  // 标签 → 它自己的数值集合：用来判断"这个盒子里的数值是不是别人的"
  const own = new Map<string, Set<string>>();
  for (const p of pairs) {
    const l = norm(p.label);
    const v = norm(p.value);
    if (!l || !v) continue;
    if (!own.has(l)) own.set(l, new Set());
    own.get(l)?.add(v);
  }
  const bad = pairs.filter(({ label, value }) => {
    const l = norm(label);
    const v = norm(value);
    if (!l || !v) return false;
    const otherValues = new Set<string>();
    for (const [otherLabel, values] of own) {
      if (otherLabel === l) continue;
      for (const ov of values) if (ov !== v) otherValues.add(ov);
    }
    return !texts.some((t, i) => {
      if (!t.includes(l)) return false;
      const nums = boxNums[i];
      if (!nums.has(v)) return false;
      for (const ov of otherValues) if (nums.has(ov)) return false;
      return true;
    });
  });
  if (bad.length === 0) return [];
  const shown = bad
    .slice(0, 2)
    .map((p) => `「${p.label}」= ${p.value}`)
    .join("、");
  return [
    {
      level: "warn",
      message: `数值与标签没在一起：${bad.length} 组数据的数值和它自己的标签不在同一个块里（${shown}）`,
    },
  ];
}

/**
 * 字幕**对不对**：屏幕上那句字幕必须来自这一页的字幕数据。
 *
 * 字幕条一次只显示一句（按语音时长切），所以他核对的是"显示的那句是不是本页的某一句"。
 * 字幕和正文是两套数据，此前完全没有核对——字幕写错字、串页、显示上一页的话都没人管。
 */
export function auditCaption(
  captionText: string | null | undefined,
  expectCaptions: readonly string[] | null | undefined,
): ElementFinding[] {
  if (!captionText) return [];
  if (!expectCaptions || expectCaptions.length === 0) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/[…⋯]+/g, "");
  const shown = norm(captionText);
  if (!shown) return [];
  /*
   * 允许"前缀/包含"关系：字幕条宽度有限，长句会被截断显示（截断是版面设计），
   * 所以要求"显示的这句是本页某句的一部分"，而不是完全相等。
   */
  const ok = expectCaptions.some((c) => {
    const e = norm(c);
    return e === shown || e.includes(shown) || shown.includes(e);
  });
  if (ok) return [];
  const head = Array.from(shown).slice(0, 12).join("");
  return [
    {
      level: "warn",
      message: `字幕对不上：画面上显示「${head}…」，但本页字幕数据里没有这句`,
    },
  ];
}

/**
 * 长文案的**前缀一致性**：渲染出来的那段，必须是数据原文的前缀。
 *
 * 长文案在页面上会被有意截断（省略号/裁切），所以不能核对尾部——那会满屏假阳性。
 * 但"截断"和"改写"有一个可分辨的差别：截断结果是原文的前缀，改写不是。
 * 于是核对方向反过来：拿渲染文本去比原文开头，对不上就说明中间被动过。
 *
 * 只在**长到会被截断**的文案上做（短文案已有首尾双片段核对，不需要它）。
 */
export function auditPrefix(
  texts: readonly string[] | null | undefined,
  rendered: readonly string[],
): ElementFinding[] {
  if (!texts || texts.length === 0) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/[…⋯.]+$/g, "");
  const boxes = rendered.map(norm).filter(Boolean);
  const bad: string[] = [];
  for (const t of texts) {
    const e = norm(t);
    if (Array.from(e).length <= 12) continue; // 短文案不归这里管
    /*
     * 找到"以这段原文开头"的渲染盒子：把每条渲染文本当作前缀去试。
     * 允许渲染文本比原文短（截断），但不允许渲染文本与原文开头不一致（改写）。
     */
    const hit = boxes.some((b) => {
      if (b.length < 8) return false;
      return e.startsWith(b) || b.startsWith(e);
    });
    if (!hit) bad.push(Array.from(e).slice(0, 10).join(""));
  }
  if (bad.length === 0) return [];
  return [
    {
      level: "warn",
      message: `长文案与原文对不上：${bad.length} 条长文案在页面上找不到"以它开头"的文字（${bad
        .slice(0, 2)
        .map((s) => `「${s}…」`)
        .join("")}）`,
    },
  ];
}

/**
 * 列表顺序：竖排要点在画面上必须按数据顺序从上到下排。
 *
 * 为什么值得单独一条：把两条步骤互换，**所有已有判据都会通过**——字都在、数字都在、
 * 首尾片段都在、标签数值也都配对。但“先拆再评估”变成“先评估再拆”是意思变了。
 * 这是少数能用几何核出来的语义错误。
 *
 * 只对单列版式生效（多栏/网格的阅读顺序本来就不是从上到下）。判定单列的方式是
 * “所有命中的盒子左边界彼此接近”，不满足就整页跳过——宁可漏，不报假。
 */
export function auditOrder(
  order: readonly string[] | null | undefined,
  boxes: readonly ElementBox[],
): ElementFinding[] {
  if (!order || order.length < 2) return [];
  const norm = (s: string) => s.replace(/\s+/g, "");
  const withText = boxes.filter((b) => (b.text ?? "").trim().length >= 6);
  const hits: { ix: number; y: number; x: number }[] = [];
  order.forEach((t, ix) => {
    const head = Array.from(norm(t)).slice(0, 6).join("");
    if (head.length < 4) return;
    const box = withText.find((b) => norm(b.text ?? "").startsWith(head));
    if (box) hits.push({ ix, y: box.y, x: box.x });
  });
  if (hits.length < 2) return [];
  const xs = hits.map((h) => h.x);
  const spread = Math.max(...xs) - Math.min(...xs);
  // 左边界散得太开 → 多栏排版，阅读顺序不是上下，跳过
  if (spread > 160) return [];
  const inversed: string[] = [];
  const short = (s: string) => Array.from(norm(s)).slice(0, 8).join("");
  for (let i = 1; i < hits.length; i++) {
    const prev = hits[i - 1];
    const cur = hits[i];
    if (cur.y < prev.y - 30) {
      inversed.push(`「${short(order[cur.ix])}…」排到了「${short(order[prev.ix])}…」上面`);
    }
  }
  if (inversed.length > 0) {
    return [
      {
        level: "warn",
        message: `列表顺序和数据不一致：${inversed.length} 处（${inversed.slice(0, 2).join("；")}）——字都没错，但先后反了，意思就变了`,
      },
    ];
  }
  return [];
}

/**
 * 字幕时长与口播对齐：第 frame 帧屏幕上显示的那句，必须是“该说那句”。
 *
 * 为什么要独立重算：渲染端自己算当前应显示第几句，审计再用 `seconds` 算一遍。
 * 两边独立得出同一个结论才算对；不一致就是“声音说 A、字幕显 B”——观众会发现，但没有判据时没人知道。
 *
 * 容差：切换点前后各留 `TOL` 帧（fade 过渡），避免卡在边界上报假。
 */
export function auditCaptionTiming(
  shownText: string | null | undefined,
  timing: { seconds: number; text: string }[] | null | undefined,
  pageFrame: number,
  fps: number,
  sentenceGap = 0,
): ElementFinding[] {
  if (!shownText || !timing || timing.length === 0 || !fps) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/[…⋯]+/g, "");
  const shown = norm(shownText);
  if (!shown) return [];
  const TOL = 3;
  // 独立复算：逐句累加 "seconds*fps + gap"
  const starts: { start: number; end: number; text: string }[] = [];
  let off = 0;
  const gapFrames = Math.round(sentenceGap * fps);
  for (const s of timing) {
    const dur = Math.max(1, Math.round(s.seconds * fps));
    starts.push({ start: off, end: off + dur, text: s.text });
    off += dur + gapFrames;
  }
  const hit = starts.find((s) => pageFrame >= s.start - TOL && pageFrame <= s.end + TOL);
  if (!hit) return []; // 落在句间间隔里，不评价
  const expect = norm(hit.text);
  const ok = expect === shown || expect.includes(shown) || shown.includes(expect);
  if (ok) return [];
  const head = Array.from(shown).slice(0, 12).join("");
  const want = Array.from(expect).slice(0, 12).join("");
  return [
    {
      level: "warn",
      message: `字幕与口播错位：第 ${pageFrame} 帧该说「${want}…」，画面却显示「${head}…」`,
    },
  ];
}

/**
 * 字幕声明时长与**真实音频长度**是否一致。
 *
 * 为什么要核：字幕和画面切换全靠 `seconds`；如果 `seconds` 和实际音频不一样，
 * 就是“声音已经说完、字幕还挂着”或“字幕已经切了、声音还在说”——观众一看就知道。
 *
 * 容差 0.15s：编码尾巴/静音会带来小偏差，但超过十分之一秒就能看出来。
 */
export function auditAudioDuration(
  rows: readonly { text: string; declared: number; real: number | null }[],
): ElementFinding[] {
  const bad: string[] = [];
  for (const r of rows) {
    if (r.real == null) continue;
    const d = r.real - r.declared;
    if (Math.abs(d) <= 0.15) continue;
    const head = Array.from(r.text.replace(/\s+/g, "")).slice(0, 8).join("");
    bad.push(
      `「${head}…」声明 ${r.declared.toFixed(2)}s、实际 ${r.real.toFixed(2)}s（差 ${d > 0 ? "+" : ""}${d.toFixed(2)}s）`,
    );
  }
  if (bad.length === 0) return [];
  return [
    {
      level: "warn",
      message: `字幕时长和真实音频对不上：${bad.length} 句（${bad.slice(0, 2).join("；")}）——声音和字幕会错开`,
    },
  ];
}

/**
 * 字幕数量与**配音句数**是否一致。
 *
 * 为什么要核：`ttsService` 对**部分失败**只 `console.warn`、不报错；
 * 失败的那句不会进 `sentences`，于是那句**没声音、也不会显示字幕**，
 * 而整个流程一路“成功”。观众只是觉得“这里忽然没声了”。
 */
export function auditSentenceCoverage(captions: number, sentences: number): ElementFinding[] {
  if (sentences >= captions) return [];
  const missing = captions - sentences;
  return [
    {
      level: "warn",
      message: `有 ${missing} 句没有配音（字幕 ${captions} 句、配音 ${sentences} 句）——这些句子不会有声音、也不显示字幕，常是 TTS 部分失败后被静默跳过`,
    },
  ];
}

/** 去掉所有空白，用来比对“是不是同一句话” */
function compactText(t: string): string {
  return t.replace(/\s+/g, "");
}

/**
 * 口播稿（`narration`）与字幕（`captions`）是否是**同一份文本**。
 *
 * 为什么要核：两者是分开存的字段。一旦它们分歧，观众就会**听到一套、看到另一套**——
 * 声音说“回复率从 12% 到 68%”，字幕却写着另一句。这不需要语义理解：同一句话必然逐字相等。
 *
 * 实测两份真实 e2e 产物（共 11 页）：**全部同一份**。
 */
export function auditNarrationMatchesCaptions(narration: string, captions: readonly string[]): ElementFinding[] {
  if (!narration || captions.length === 0) return [];
  const a = compactText(narration);
  const b = compactText(captions.join(""));
  if (a === b) return [];
  /*
   * 报“从第几个字开始不一样”——比报两段长文字有用得多。
   */
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const at = i + 1;
  const tail = (s: string) => Array.from(s.slice(i)).slice(0, 10).join("");
  return [
    {
      level: "warn",
      message:
        `口播稿与字幕不是同一句话（从第 ${at} 个字开始分歧）：` +
        `口播「${tail(a)}」、字幕「${tail(b)}」——观众会听到一套、看到另一套`,
    },
  ];
}

/** 转场帧数（与 shared/types.ts 的 TRANSITION_FRAME_MAP 一致） */
const TRANSITION_FRAMES: Record<string, number> = {
  none: 1,
  fade: 12,
  "slide-left": 14,
  "slide-right": 14,
  zoom: 16,
};

export interface FramePageLike {
  durationSec?: number;
  sentenceGap?: number;
  transition?: string;
  sentences?: { seconds: number }[];
}

/**
 * 分镜应当炸出多少帧（与渲染端 DynamicVideo 的算法一致）。
 *
 * 页帧数 = Σ round(seconds×fps) + round(gap×fps)×(n−1)；
 * TransitionSeries 用**下一页**的 transition 长度重叠，所以总数要减掉这些重叠。
 *
 * 实测两份真实 e2e 成片：预期 1899 / 2028 帧，成片实测 1900 / 2029（均差 1 帧，舍入）。
 */
export function expectedFrames(pages: readonly FramePageLike[], fps: number): number {
  let total = 0;
  for (const p of pages) {
    const sentences = p.sentences ?? [];
    total += sentences.length
      ? sentences.reduce((a, s) => a + Math.max(1, Math.round(s.seconds * fps)), 0) +
        Math.round((p.sentenceGap || 0) * fps) * Math.max(0, sentences.length - 1)
      : Math.round((p.durationSec || 4) * fps);
  }
  let overlap = 0;
  for (let i = 0; i < pages.length - 1; i++) {
    overlap += TRANSITION_FRAMES[pages[i + 1].transition ?? "fade"] ?? 12;
  }
  return total - overlap;
}

export interface TruncationInfo {
  /** 有几条长文案被截断显示 */
  count: number;
  /** 被截掉、观众看不到的字数合计 */
  hiddenChars: number;
  /** 举例（前 2 条被截掉的开头） */
  samples: string[];
}

/**
 * 量化“有多少字没上画面”。
 *
 * 长文案被截断是**版面设计**（不截就溢出），所以这不算错误；但“截掉了多少”以前
 * 没人知道——实测 `points-long` 有 50 字、`qa` 有 14 字读者看不到。这是编辑决策
 * 需要的事实，给出数字比给出感觉有用。
 */
export function measureTruncation(
  texts: readonly string[] | null | undefined,
  boxes: readonly ElementBox[],
): TruncationInfo {
  const empty: TruncationInfo = { count: 0, hiddenChars: 0, samples: [] };
  if (!texts || texts.length === 0) return empty;
  const norm = (s: string) => s.replace(/\s+/g, "");
  const shown = boxes.map((b) => norm(b.text ?? "")).filter((s) => s.length >= 8);
  let count = 0;
  let hidden = 0;
  const samples: string[] = [];
  for (const t of texts) {
    const e = norm(t);
    const ch = Array.from(e);
    const b = shown.filter((x) => e.startsWith(x)).sort((a, c) => c.length - a.length)[0];
    if (!b) continue;
    const cut = ch.length - Array.from(b).length;
    if (cut <= 0) continue;
    count++;
    hidden += cut;
    if (samples.length < 2) samples.push(`「${ch.slice(ch.length - cut, ch.length - cut + 6).join("")}…」`);
  }
  return { count, hiddenChars: hidden, samples };
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
