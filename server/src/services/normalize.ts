import { checkPageCode } from "./codePage.js";
import type {
  Storyboard,
  StoryPage,
  ChartSpec,
  Layout,
  Art,
  PageRole,
  IconId,
  TableSpec,
  PageRhythm,
  TransitionType,
  MotionStyle,
  PageEffects,
  CustomSvgSpec,
  SvgElement,
  MapMarker,
  MapRoute,
  MapRegion,
  MapSpec,
  ComparisonSides,
} from "../types.js";

export interface PlanBlock {
  idea?: string;
  chart?: boolean;
  table?: boolean;
  layout?: Layout;
  art?: Art;
  role?: PageRole;
  icon?: IconId;
  rhythm?: PageRhythm;
  accent?: number;
  decor?: "full" | "quiet";
  transition?: TransitionType;
  motion?: MotionStyle;
  effects?: PageEffects;
  visual?: string;
}
export interface Plan {
  projectTitle?: string;
  arc?: string;
  pages?: PlanBlock[];
}

export const STRUCTURAL_LAYOUTS = new Set([
  "steps",
  "two_column",
  "comparison",
  "three_card",
  "chart",
  "table",
  "map",
  "stats",
  "qa",
]);

export function extractJson(text: string): string {
  const t = text.replace(/```json|```/g, "").trim();
  for (let start = 0; start < t.length; start++) {
    if (t[start] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = t.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
  }
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s >= 0 && e > s) return t.slice(s, e + 1);
  return t;
}

/**
 * 解析模型返回的 JSON。返回 unknown——内容完全不可信，
 * 调用方必须自己收窄（见 normalizeDirect / normalizePage）。
 */
export function parseJson(text: string): unknown {
  const t = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {}
  const candidate = extractJson(t);
  if (candidate) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {}
  }
  return { pages: [] };
}

export function parsePlan(raw: string): Plan {
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    return { pages: [] };
  }
}

const VALID_LAYOUTS = [
  "title",
  "section",
  "points",
  "three_card",
  "comparison",
  "chart",
  "table",
  "end",
  "two_column",
  "steps",
  "stats",
  "qa",
  "map",
  "code",
];
const VALID_ROLES: PageRole[] = [
  "hook",
  "familiar",
  "puzzle",
  "build",
  "mechanism",
  "scale",
  "evidence",
  "case",
  "compare",
  "why",
  "action",
  "end",
];
const VALID_ICONS = [
  "trend",
  "chart",
  "clock",
  "scale",
  "gear",
  "bulb",
  "question",
  "alert",
  "check",
  "search",
  "target",
  "rocket",
  "heart",
  "shield",
  "db",
  "globe",
  "book",
  "bolt",
  "star",
  "flag",
  "link",
  "users",
  "wallet",
  "box",
  "layers",
  "code",
  "pie",
  "calendar",
  "map",
  "cloud",
  "lock",
  "eye",
  "compass",
  "home",
  "award",
] as IconId[];
const VALID_RHYTHMS = ["anchor", "dense", "breathing"] as PageRhythm[];
const VALID_TRANSITIONS = ["fade", "slide-left", "slide-right", "zoom", "none"] as TransitionType[];
const VALID_MOTIONS = ["spring", "linear", "float"] as MotionStyle[];
const VALID_ARTS: Art[] = ["flow", "loop", "timeline", "quadrant", "quote"];
const VALID_DECORS = ["full", "quiet"];

export function validatePlan(p: Plan): string[] {
  const problems: string[] = [];
  if (!p || !Array.isArray(p.pages)) return problems;
  const pages = p.pages;
  pages.forEach((pg, i) => {
    if (pg.layout != null && !VALID_LAYOUTS.includes(pg.layout)) {
      problems.push(
        `第${i + 1}页 layout="${pg.layout}" 非法：layout 只能取 title|section|points|three_card|comparison|chart|table|end|two_column|steps|stats|qa|map 这 14 个（"mechanism""scale" 等是 role 的取值，不是 layout）`,
      );
    }
    if (pg.role != null && !VALID_ROLES.includes(pg.role)) {
      problems.push(`第${i + 1}页 role="${pg.role}" 非法：role 只能取 ${VALID_ROLES.join("/")} 之一`);
    }
    if (pg.art != null && !VALID_ARTS.includes(pg.art)) {
      problems.push(`第${i + 1}页 art="${pg.art}" 非法：art 只能取 ${VALID_ARTS.join("/")} 或 null`);
    }
    if (pg.rhythm != null && !VALID_RHYTHMS.includes(pg.rhythm)) {
      problems.push(`第${i + 1}页 rhythm="${pg.rhythm}" 非法：rhythm 只能取 anchor|dense|breathing 之一`);
    }
    if (pg.transition != null && !VALID_TRANSITIONS.includes(pg.transition)) {
      problems.push(
        `第${i + 1}页 transition="${pg.transition}" 非法：transition 只能取 fade|slide-left|slide-right|zoom|none 之一`,
      );
    }
    if (pg.motion != null && !VALID_MOTIONS.includes(pg.motion)) {
      problems.push(`第${i + 1}页 motion="${pg.motion}" 非法：motion 只能取 spring|linear|float 之一`);
    }
    if (pg.accent != null) {
      const acc = Number(pg.accent);
      if (!Number.isInteger(acc) || acc < 0 || acc > 5) {
        problems.push(
          `第${i + 1}页 accent=${JSON.stringify(pg.accent)} 非法：accent 只能是 0~5 的整数（主题调色板序号）`,
        );
      }
    }
    if (pg.decor != null && !VALID_DECORS.includes(pg.decor)) {
      problems.push(`第${i + 1}页 decor="${pg.decor}" 非法：decor 只能取 full|quiet 之一`);
    }
    if (pg.icon != null && !VALID_ICONS.includes(pg.icon)) {
      problems.push(`第${i + 1}页 icon="${pg.icon}" 非法：icon 只能取内置枚举之一，或 null`);
    }
    if (pg.chart != null && typeof pg.chart !== "boolean") {
      problems.push(`第${i + 1}页 chart 只能是 true/false`);
    }
    if (pg.table != null && typeof pg.table !== "boolean") {
      problems.push(`第${i + 1}页 table 只能是 true/false`);
    }
    if (pg.chart === true && pg.layout !== "chart") {
      problems.push(
        `第${i + 1}页 chart=true 但 layout="${pg.layout ?? "points"}"：二者不一致。若本页要画图表，layout 必须改为 "chart"；若本页用其它版式，chart 应设为 false。`,
      );
    }
    if (pg.table === true && pg.layout !== "table") {
      problems.push(
        `第${i + 1}页 table=true 但 layout="${pg.layout ?? "points"}"：二者不一致。若本页要放表格，layout 必须改为 "table"；若本页用其它版式，table 应设为 false。`,
      );
    }
    if (pg.visual && /三卡片|三张|三种|三个|并列卡片|并列对比|多卡片/i.test(pg.visual)) {
      if (pg.layout !== "three_card") {
        problems.push(
          `第${i + 1}页 visual="${pg.visual}" 描述的是「三张/多个并列卡片」，但 layout="${pg.layout ?? "points"}"。若本页要并列展示 3 个选项，layout 必须改为 "three_card"（恰好 3 个并列卡片）；若本页用其它版式，请把 visual 改成与该版式匹配的描述。`,
        );
      }
    } else if (pg.visual && /对比|左右|vs|versus|优劣|差异|区别/i.test(pg.visual)) {
      if (pg.layout !== "comparison") {
        problems.push(
          `第${i + 1}页 visual="${pg.visual}" 描述的是「两方对比」，但 layout="${pg.layout ?? "points"}"。若本页要画对比图，layout 必须改为 "comparison"（并给 A/B 两侧）；若本页用其它版式，请把 visual 改成与该版式匹配的描述。`,
        );
      }
    }
    if (pg.visual && /结构图|流程图|示意图|关系图|架构图|步骤图|输入.*处理.*输出|→.*→/i.test(pg.visual)) {
      if (!pg.art && (pg.layout === "two_column" || pg.layout === "points")) {
        problems.push(
          `第${i + 1}页 visual="${pg.visual}" 描述的是「结构/流程/关系图」，但 layout="${pg.layout ?? "points"}" 且未指定 art。若本页要画结构图，请给 art（如 "flow"/"pyramid"/"loop"）并保持 layout 为 "points"；若本页用 ${pg.layout} 版式，请把 visual 改成与该版式匹配的描述（如"概念+案例左右两栏"）。`,
        );
      }
    }
  });
  const first = pages[0];
  const last = pages[pages.length - 1];
  if (first && first.layout !== "title") {
    problems.push(`第1页 layout="${first.layout}"，应为 "title" 封面（视频需要开场封面页）。`);
  }
  if (last && last.layout !== "end") {
    problems.push(`最后一页(第${pages.length}页) layout="${last.layout}"，应为 "end" 结尾页（视频需要收尾页）。`);
  }
  return problems;
}

const ROLES: PageRole[] = [
  "hook",
  "familiar",
  "puzzle",
  "build",
  "mechanism",
  "scale",
  "evidence",
  "case",
  "compare",
  "why",
  "action",
  "end",
];
/**
 * LLM 输出的值一律按 unknown 进来，归一化层自己收窄。
 *
 * 这两个小工具替代了原来的 `any` + `includes()`：
 * - isRecord：排除 null / 数组（typeof [] 也是 "object"，不能只看 typeof）
 * - oneOf：只接受字符串且在白名单内，否则 null
 */
/** 把任意值当对象读（非对象当空对象）——供 parseJson 调用方使用 */
export const asRecord = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;

export function normalizeRole(r: unknown): PageRole | null {
  return oneOf(r, ROLES);
}

const ICON_IDS: IconId[] = [
  "trend",
  "chart",
  "clock",
  "scale",
  "gear",
  "bulb",
  "question",
  "alert",
  "check",
  "search",
  "target",
  "rocket",
  "heart",
  "shield",
  "db",
  "globe",
  "book",
  "bolt",
  "star",
  "flag",
  "link",
  "users",
  "wallet",
  "box",
  "layers",
  "code",
  "pie",
  "calendar",
  "map",
  "cloud",
  "lock",
  "eye",
  "compass",
  "home",
  "award",
];
export function normalizeIcon(x: unknown): IconId | null {
  return oneOf(x, ICON_IDS);
}

const LAYOUT_IDS: Layout[] = [
  "title",
  "section",
  "points",
  "three_card",
  "comparison",
  "chart",
  "table",
  "end",
  "two_column",
  "steps",
  "stats",
  "qa",
  "map",
  "code",
];
export function normalizeLayout(l: unknown): Layout {
  return oneOf(l, LAYOUT_IDS) ?? "points";
}

/**
 * 模型没给版式时，按内容推一个。
 *
 * 为什么需要：`normalizeLayout` 的兜底是 `points`，而"走兜底一次性生成"的那条路径里模型
 * 经常整片不给 `layout` —— 实测出现过 6 页全是 `points`，分镜退化成一条要点列表，
 * 图表/表格数据照样渲成要点（因为 `chart`/`table` 字段本身为空，场景注册表也只能落到 PointsScene）。
 *
 * 规则按"内容能不能装进这个版式"排，能装的里面**避开最近两页用过的**，这样同一份内容
 * 不会连续三页长得一样：
 * - 有 table / chart / 左右对比 → 只能是它们（内容专属）
 * - 3 条要点 → three_card / steps / points 轮换
 * - ≥4 条要点 → two_column / points 轮换（two_column 会把要点对半分两栏）
 * - 1~2 条 → points
 *
 * 注意：只在**没有合法 layout** 时调用。用户/AI 显式写了的版式一律不动。
 */
export function deriveLayout(input: {
  index: number;
  points: number;
  hasChart: boolean;
  hasTable: boolean;
  hasSides: boolean;
  /** 最近两页已经用过的版式，用来避免连续重复 */
  recent?: Layout[];
}): Layout {
  const { index, points, hasChart, hasTable, hasSides } = input;
  const recent = input.recent ?? [];
  if (hasTable) return "table";
  if (hasChart) return "chart";
  if (hasSides) return "comparison";
  const pick = (candidates: Layout[]): Layout => {
    const fresh = candidates.filter((l) => !recent.includes(l));
    const pool = fresh.length ? fresh : candidates;
    return pool[index % pool.length];
  };
  if (points === 3) return pick(["points", "three_card", "steps"]);
  if (points >= 4) return pick(["points", "two_column"]);
  return "points";
}

/** 页面主色序号：非法/越界一律丢弃（回落到主题默认主色），不做猜测 */
export function normalizeAccent(a: unknown): number | undefined {
  if (a == null || a === "") return undefined;
  /*
   * 只接受字符串/数字。原来直接 Number(a)：
   * Number([]) === 0、Number(true) === 1，于是空数组会静默把页面主色改成第 0 档（实测）。
   */
  if (typeof a !== "string" && typeof a !== "number") return undefined;
  const n = Number(a);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.round(n);
  return i >= 0 && i <= 5 ? i : undefined;
}

export function normalizeDecor(d: unknown): "full" | "quiet" | undefined {
  return oneOf(d, ["full", "quiet"] as const) ?? undefined;
}
export function normalizeRhythm(r: unknown): PageRhythm {
  return oneOf(r, ["anchor", "dense", "breathing"] as const) ?? "anchor";
}

export function normalizeTransition(t: unknown): TransitionType {
  return oneOf(t, ["fade", "slide-left", "slide-right", "zoom", "none"] as const) ?? "fade";
}

export function normalizeMotion(m: unknown): MotionStyle {
  return oneOf(m, ["spring", "linear", "float"] as const) ?? "spring";
}

export function normalizeEffects(e: unknown): PageEffects {
  if (!isRecord(e)) return {};
  return {
    annotation: oneOf(e.annotation, ["highlight", "underline", "circle"] as const) ?? undefined,
    pathDraw: e.pathDraw === true ? true : undefined,
    threeD: e.threeD === true ? true : undefined,
  };
}

export function normalizeArt(a: unknown): Art | null {
  return oneOf(a, ["flow", "loop", "timeline", "quadrant", "quote"] as const);
}

function normalizeAnchor(x: unknown): number | undefined {
  if (typeof x !== "number" && typeof x !== "string") return undefined;
  const n = Number(x);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : undefined;
}

function normalizePoint(x: unknown): { text: string; icon: IconId | null; anchor?: number } {
  if (typeof x === "string") return { text: x, icon: null };
  if (isRecord(x)) {
    return {
      text: String(x.text ?? "").trim(),
      icon: normalizeIcon(x.icon ?? null),
      anchor: normalizeAnchor(x.anchor),
    };
  }
  return { text: typeof x === "number" ? String(x) : "", icon: null };
}

function normalizeSides(s: unknown): ComparisonSides | null {
  const root = isRecord(s) ? s : {};
  const one = (side: unknown) => {
    if (!isRecord(side)) return null;
    const label = String(side.label ?? "")
      .trim()
      .slice(0, 20);
    if (!label) return null;
    const pts = (Array.isArray(side.points) ? side.points : [])
      .slice(0, 4)
      .map(normalizePoint)
      .filter((x: { text: string }) => x.text);
    if (!pts.length) return null;
    return { label, points: pts };
  };
  const a = one(root.a);
  const b = one(root.b);
  return a && b ? { a, b } : null;
}

function normalizeChart(input: unknown): ChartSpec {
  if (!isRecord(input)) return null;
  const c = input;
  const t =
    c.type === "bar"
      ? "bar"
      : c.type === "line"
        ? "line"
        : c.type === "pie"
          ? "pie"
          : c.type === "pyramid"
            ? "pyramid"
            : c.type === "area"
              ? "area"
              : c.type === "donut"
                ? "donut"
                : c.type === "stacked-bar"
                  ? "stacked-bar"
                  : c?.type === "scatter"
                    ? "scatter"
                    : "";
  if (!t) return null;
  const title = String(c.title ?? "对比");
  const cap = 6;

  // scatter 只给 points、stacked-bar 只给 series，两者都没有 labels/values。
  // 必须在通用等长校验之前分流，否则它们会被判成「labels 与 values 不匹配」直接作废。
  if (t === "scatter") {
    const points = (Array.isArray(c.points) ? c.points : [])
      .slice(0, 12)
      .map((raw: unknown) => {
        const pt = isRecord(raw) ? raw : {};
        return {
          x: Number(pt.x),
          y: Number(pt.y),
          label: pt.label ? String(pt.label).slice(0, 8) : undefined,
        };
      })
      .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
    if (points.length < 2) return null;
    return { type: "scatter", points, title };
  }

  const labels = (Array.isArray(c.labels) ? c.labels : []).slice(0, cap).map(String).filter(Boolean);
  if (!labels.length) return null;

  if (t === "stacked-bar") {
    const series = (Array.isArray(c.series) ? c.series : [])
      .slice(0, 4)
      .map((raw: unknown) => {
        const s = isRecord(raw) ? raw : {};
        return {
          name: String(s.name ?? "").slice(0, 10),
          values: (Array.isArray(s.values) ? s.values : [])
            .slice(0, cap)
            .map(Number)
            .filter((n: number) => !Number.isNaN(n)),
        };
      })
      .filter((s) => s.name && s.values.length === labels.length);
    if (!series.length) return null;
    return { type: "stacked-bar", labels, series, title };
  }

  const values = (Array.isArray(c.values) ? c.values : [])
    .slice(0, cap)
    .map(Number)
    .filter((n: number) => !Number.isNaN(n));
  if (values.length !== labels.length) return null;
  if (t === "pie") return { type: "pie", labels, values, title };
  if (t === "donut") return { type: "donut", labels, values, title };
  if (t === "pyramid") return { type: "pyramid", labels, values, title };
  if (t === "area") return { type: "area", labels, values, title };
  return { type: t as "bar" | "line", labels, values, title };
}

function normalizeTable(t: unknown): TableSpec | null {
  if (!isRecord(t) || !Array.isArray(t.headers) || !Array.isArray(t.rows)) return null;
  const headers = (t.headers as unknown[]).slice(0, 5).map((x) => String(x ?? ""));
  const w = headers.length;
  if (!w) return null;
  const rows = (t.rows as unknown[])
    .slice(0, 5)
    .map((r) => (Array.isArray(r) ? (r as unknown[]).slice(0, w).map((x) => String(x ?? "")) : []))
    .filter((r: string[]) => r.length === w);
  if (!rows.length) return null;
  return { headers, rows };
}

const SVG_TYPES = ["circle", "rect", "ellipse", "line", "path", "polygon", "text"] as const;

function normalizeCustomSvg(c: unknown): CustomSvgSpec {
  if (!Array.isArray(c)) return null;
  const num = (x: unknown, min = -2000, max = 2000) =>
    typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : undefined;
  const str = (x: unknown, max = 200) => (typeof x === "string" ? x.slice(0, max) : undefined);

  const els = (c as unknown[])
    .slice(0, 60)
    .map((raw: unknown): SvgElement | null => {
      if (!isRecord(raw)) return null;
      const e = raw;
      const type = oneOf(e.type, SVG_TYPES);
      if (!type) return null;
      const el: SvgElement = { type };
      const NUM_KEYS = ["x", "y", "cx", "cy", "r", "width", "height", "rx", "ry", "x1", "y1", "x2", "y2"] as const;
      for (const k of NUM_KEYS) {
        const v = num(e[k]);
        if (v !== undefined) el[k] = v;
      }
      const Y_MAX = 780;
      for (const k of ["y", "cy", "y1", "y2"] as const) {
        const v = el[k];
        if (typeof v === "number" && v > Y_MAX) el[k] = Y_MAX;
      }
      if (type === "rect" && typeof el.y === "number" && typeof el.height === "number" && el.y + el.height > Y_MAX) {
        el.y = Math.max(220, Y_MAX - el.height);
      }
      if (type === "path") {
        const d = str(e.d, 2000);
        if (!d) return null;
        el.d = d;
      }
      if (type === "polygon") {
        const pts = str(e.points, 500);
        if (!pts) return null;
        el.points = pts;
      }
      const fill = str(e.fill, 30);
      if (fill) el.fill = fill;
      const stroke = str(e.stroke, 30);
      if (stroke) el.stroke = stroke;
      const sw = num(e.strokeWidth, 0, 50);
      if (sw !== undefined) el.strokeWidth = sw;
      const op = num(e.opacity, 0, 1);
      if (op !== undefined) el.opacity = op;
      if (type === "text") {
        const text = str(e.text, 40);
        if (!text) return null;
        el.text = text;
        if (typeof el.y === "number" && el.y > 760) el.y = 760;
        const fs = num(e.fontSize, 8, 200);
        if (fs !== undefined) el.fontSize = fs;
        const fw = num(e.fontWeight, 100, 900);
        if (fw !== undefined) el.fontWeight = fw;
        const textAnchor = oneOf(e.textAnchor, ["start", "middle", "end"] as const);
        if (textAnchor) el.textAnchor = textAnchor;
      }
      const delay = num(e.delay, 0, 300);
      if (delay !== undefined) el.delay = delay;
      const anchor = normalizeAnchor(e.anchor);
      if (anchor !== undefined) el.anchor = anchor;
      if (e.draw === true) el.draw = true;
      return el;
    })
    .filter((el): el is SvgElement => el !== null);

  return els.length ? els : null;
}

function normalizeMap(input: unknown): MapSpec | null {
  if (!isRecord(input)) return null;
  const m = input;
  const num = (x: unknown, min = -2000, max = 2000) =>
    typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : undefined;
  const str = (x: unknown, max = 40) => (typeof x === "string" ? x.slice(0, max) : undefined);
  const color = (x: unknown) => (typeof x === "string" && x.length <= 30 ? x : undefined);

  const markers = (Array.isArray(m.markers) ? (m.markers as unknown[]) : [])
    .slice(0, 12)
    .map((raw: unknown): MapMarker | null => {
      if (!isRecord(raw)) return null;
      const mk = raw;
      const name = str(mk.name);
      const x = num(mk.x, 0, 1920);
      const y = num(mk.y, 0, 1080);
      if (!name || x === undefined || y === undefined) return null;
      const el: MapMarker = { name, x, y };
      const c = color(mk.color);
      if (c) el.color = c;
      const s = num(mk.size, 4, 40);
      if (s !== undefined) el.size = s;
      const anchor = normalizeAnchor(mk.anchor);
      if (anchor !== undefined) el.anchor = anchor;
      return el;
    })
    .filter((mk): mk is MapMarker => mk !== null);

  const routes = (Array.isArray(m.routes) ? (m.routes as unknown[]) : [])
    .slice(0, 12)
    .map((raw: unknown): MapRoute | null => {
      if (!isRecord(raw)) return null;
      const rt = raw;
      const from = num(rt.from, 0, markers.length - 1);
      const to = num(rt.to, 0, markers.length - 1);
      if (from === undefined || to === undefined || from === to) return null;
      const el: MapRoute = { from, to };
      const c = color(rt.color);
      if (c) el.color = c;
      if (rt.dashed === true) el.dashed = true;
      if (rt.animated === false) el.animated = false;
      if (rt.flow === false) el.flow = false;
      const routeType = oneOf(rt.type, ["rail", "flight", "road"] as const);
      if (routeType) el.type = routeType;
      const anchor = normalizeAnchor(rt.anchor);
      if (anchor !== undefined) el.anchor = anchor;
      return el;
    })
    .filter((rt): rt is MapRoute => rt !== null);

  const regions = (Array.isArray(m.regions) ? (m.regions as unknown[]) : [])
    .slice(0, 6)
    .map((raw: unknown): MapRegion | null => {
      if (!isRecord(raw)) return null;
      const rg = raw;
      const points = typeof rg.points === "string" ? rg.points.slice(0, 500) : undefined;
      if (!points) return null;
      const el: MapRegion = { points };
      const name = str(rg.name);
      if (name) el.name = name;
      const label = str(rg.label);
      if (label) el.label = label;
      const c = color(rg.color);
      if (c) el.color = c;
      const anchor = normalizeAnchor(rg.anchor);
      if (anchor !== undefined) el.anchor = anchor;
      return el;
    })
    .filter((rg): rg is MapRegion => rg !== null);

  if (!markers.length && !routes.length && !regions.length) return null;
  const out: MapSpec = {};
  if (markers.length) out.markers = markers;
  if (routes.length) out.routes = routes;
  if (regions.length) out.regions = regions;
  return out;
}

function estimateSecs(items: unknown[]): number {
  const totalChars = items.map((x) => String(x ?? "").length).reduce((a, b) => a + b, 0);
  return Math.max(3, Math.ceil(totalChars / 5 + 1));
}

function splitCaptions(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [t];
}

export function normalizePage(
  input: unknown,
  i: number,
  layout?: Layout,
  art?: Art | null,
  role?: PageRole | null,
  icon?: IconId | null,
  rhythm?: PageRhythm,
  transition?: TransitionType,
  motion?: MotionStyle,
  effects?: PageEffects,
  /** 归一化过程发现的问题（供重试提示使用，不进入产物） */
  diagnostics?: string[],
  /** 最近两页用过的版式：仅在模型没给合法 layout 时用来避开连续重复（见 deriveLayout） */
  recentLayouts?: Layout[],
): StoryPage {
  /*
   * 外部（LLM / 手改分镜）传进来的是任意值，一律按 unknown 接。
   * 原来签名是 any，normalizeDirect 里的 null 页会直接炸在 p.chart（实测抛
   * TypeError）；非对象一律当空页处理，走同一套默认值。
   */
  const p = isRecord(input) ? input : {};
  const chart = normalizeChart(p.chart);
  const table = normalizeTable(p.table);
  const rawSvg = normalizeCustomSvg(p.customSvg);
  const artVal = normalizeArt(art ?? p.art ?? null);
  /*
   * 模型没给（或给了非法值）时按内容推版式，而不是一律回到 points。
   * 实测：走兜底生成时曾经 6 页全是 points，整片退化成要点列表。
   */
  const explicitLayout = oneOf(layout ?? p.layout, LAYOUT_IDS);
  const rawPoints = Array.isArray(p.points) ? (p.points as unknown[]).filter((x) => x != null).length : 0;
  const layoutVal =
    explicitLayout ??
    deriveLayout({
      index: i,
      points: rawPoints,
      hasChart: !!chart,
      hasTable: !!table,
      hasSides: !!(p.sides ?? p.comparisonSides),
      recent: recentLayouts,
    });
  const customSvg = rawSvg && layoutVal !== "title" && layoutVal !== "end" && !chart && !table ? rawSvg : null;
  const hasSvg = !!customSvg;
  const finalArt = hasSvg ? null : artVal;

  // 生成式版式：源码必须过 AST 白名单校验并转译成功，否则整页降级回 points
  let code: string | undefined;
  if (layoutVal === "code") {
    const rawCode = typeof p.code === "string" ? p.code : "";
    if (!rawCode) {
      diagnostics?.push("本页版式为 code（生成式版式），但缺少 code 字段。");
    } else {
      const checked = checkPageCode(rawCode);
      if (checked.ok && checked.js) code = checked.js;
      else for (const problem of checked.problems) diagnostics?.push(`生成代码不合格：${problem}`);
    }
    if (!code) diagnostics?.push("已自动降级为 points 版式；请严格按 Kit 白名单重写 code，或改用常规版式。");
  }

  const finalLayout =
    (hasSvg && STRUCTURAL_LAYOUTS.has(layoutVal)) || (layoutVal === "code" && !code) ? "points" : layoutVal;
  /*
   * 字幕只接受字符串。原来 String(x) 会把 null / {} 变成
   * "null" / "[object Object]"，然后作为字幕条直接烧进成片（实测）。
   */
  const rawCaptions = (Array.isArray(p.captions) ? (p.captions as unknown[]) : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  const rawNarration = String(p.narration ?? "").trim();
  const pointsArr: unknown[] = Array.isArray(p.points) ? (p.points as unknown[]) : [];
  const pointsText = pointsArr
    .map((x) => (typeof x === "string" ? x : isRecord(x) ? String(x.text ?? "") : ""))
    .filter(Boolean)
    .join("，");
  const narration = rawNarration || rawCaptions.join("") || pointsText;
  const captions = rawCaptions.length ? rawCaptions : splitCaptions(narration);
  const durationSec = estimateSecs(narration ? [narration] : captions.length ? captions : pointsArr);
  return {
    pageIndex: i,
    title: String(p.title ?? `第${i + 1}页`).slice(0, 24),
    points: pointsArr
      .slice(0, 10)
      .map(normalizePoint)
      .filter((x: { text: string; icon: IconId | null }) => x.text),
    narration,
    captions,
    chart,
    layout: finalLayout,
    art: finalArt,
    role: normalizeRole(role ?? p.role ?? null),
    icon: normalizeIcon(icon ?? p.icon ?? null),
    table,
    comparisonSides: normalizeSides(p.sides ?? p.comparisonSides),
    durationSec,
    rhythm: normalizeRhythm(rhythm ?? p.rhythm ?? "anchor"),
    accent: normalizeAccent(p.accent),
    decor: normalizeDecor(p.decor),
    transition: normalizeTransition(transition ?? p.transition ?? "fade"),
    motion: normalizeMotion(motion ?? p.motion ?? "spring"),
    effects: normalizeEffects(effects ?? p.effects ?? {}),
    customSvg,
    map: normalizeMap(p.map),
    code,
  };
}

export function normalizeDirect(input: unknown): Storyboard {
  const pages = isRecord(input) ? input : {};
  const list = (Array.isArray(pages.pages) ? (pages.pages as unknown[]) : []).slice(0, 10);
  /*
   * 逐页归一化，并把"最近两页的版式"传下去。
   * 兜底生成那条路模型常常整片不写 layout；没有这个上下文时 deriveLayout 只能按 index 轮换，
   * 有了它，相邻三页不会撞成同一个版式（实测曾经 6 页全是 points）。
   */
  const out: StoryPage[] = [];
  list.forEach((p, i) => {
    const recent = out.slice(-2).map((x) => x.layout ?? "points");
    out.push(
      normalizePage(
        p,
        i,
        /* layout */ undefined,
        /* art */ undefined,
        /* role */ undefined,
        /* icon */ undefined,
        /* rhythm */ undefined,
        /* transition */ undefined,
        /* motion */ undefined,
        /* effects */ undefined,
        /* diagnostics */ undefined,
        /* recentLayouts */ recent,
      ),
    );
  });
  return {
    projectTitle: String(pages.projectTitle ?? "我的讲解").slice(0, 22),
    pages: out,
  };
}

const STOP_CHARS = new Set(
  "的了是在这和就有也都很把被让使对为与而之及或们这那你我他她它以很更还并从其这个那个会有要可以看作其中不仅以及但是因为所以如果那么无论如何对于就是这些这样那些因此".split(
    "",
  ),
);

export function captionOverlapInfo(a: string, b: string): { ratio: number; inter: number } {
  const clean = (s: string) => [...s.replace(/[，。！？、；：""''·…—\s\d]/g, "")].filter((ch) => !STOP_CHARS.has(ch));
  const sa = new Set(clean(a));
  const sb = new Set(clean(b));
  if (sa.size < 4 || sb.size < 4) return { ratio: 0, inter: 0 };
  let inter = 0;
  for (const ch of sa) if (sb.has(ch)) inter++;
  return { ratio: inter / Math.min(sa.size, sb.size), inter };
}

export function captionOverlap(a: string, b: string): number {
  return captionOverlapInfo(a, b).ratio;
}

export function validatePageContent(page: StoryPage): string[] {
  const problems: string[] = [];
  if (!page) return problems;
  const hasSvg = Array.isArray(page.customSvg) && page.customSvg.length > 0;
  const hasArt = !!page.art;
  const hasChart = !!page.chart && page.layout !== "chart";
  const hasTable = !!page.table && page.layout !== "table";

  if (hasSvg && hasArt) {
    problems.push(
      `本页同时给出了 art="${page.art}" 和 customSvg 结构图：渲染端会优先采用 customSvg。请删除冗余的 art（把 art 设为 null，保留 customSvg 即可）。`,
    );
  }
  if (hasSvg && hasChart) {
    problems.push(
      `本页同时给出了 customSvg 结构图和图表：customSvg 与图表（chart）互斥，只能保留一个。请删掉其中一个。`,
    );
  }
  if (hasSvg && hasTable) {
    problems.push(`本页同时给出了 customSvg 结构图和表格（table）：互斥，只能保留一个。请删掉其中一个。`);
  }

  if (hasArt && STRUCTURAL_LAYOUTS.has(page.layout ?? "")) {
    problems.push(
      `本页同时给了 layout="${page.layout}" 和 art="${page.art}"，二者互斥（一页只用一个结构载体）。请二选一：若用 ${page.layout} 版式，把 art 设为 null；若用 ${page.art} 关系图，把 layout 改为 "points"。`,
    );
  }
  if (hasSvg && STRUCTURAL_LAYOUTS.has(page.layout ?? "")) {
    problems.push(
      `本页同时给了 layout="${page.layout}" 和 customSvg 结构图，二者互斥（渲染端 customSvg 优先，${page.layout} 版式会被忽略）。请二选一：若用 ${page.layout} 版式，删掉 customSvg；若用 customSvg 画图，把 layout 改为 "points"。`,
    );
  }

  const pointCount = (page.points ?? []).length;
  if (!hasSvg && page.art && pointCount > 0 && pointCount < 3 && page.art !== "quote") {
    problems.push(
      `本页 art="${page.art}" 需要至少 3 个环节/层级要点（建议 3~6 个），当前只有 ${pointCount} 条，请补足（quote 页除外，可只给金句+署名两条）。`,
    );
  }
  if (page.layout === "comparison") {
    const sides = page.comparisonSides;
    if (sides) {
      const na = sides.a.points.length;
      const nb = sides.b.points.length;
      if (na > 4 || nb > 4) {
        problems.push(
          `本页 comparison 的 sides 每侧最多 4 条要点（当前 A ${na} 条 / B ${nb} 条），请各精简到 2~3 条。`,
        );
      } else if (na !== nb) {
        problems.push(
          `本页 comparison 的 sides 两侧条数不等（A ${na} 条 / B ${nb} 条），对比维度无法一一对应，请改成两侧条数相同（各 2~3 条），第 k 条 A 与第 k 条 B 讲同一个维度。`,
        );
      }
    } else if (pointCount < 2) {
      problems.push(
        `本页版式是 comparison（两方对比），要点（含两侧描述）不足 2 条，请把对比双方的差异各给 2~3 条（并按要求给 sides 分组）。`,
      );
    } else if (pointCount % 2 !== 0) {
      problems.push(
        `本页版式是 comparison，要点为 ${pointCount} 条（奇数），无法对半拆成左右两栏。必须给【偶数】条：A 侧 2~3 条在前、B 侧 2~3 条在后，两侧条数相等、第 i 条 A 对应第 i 条 B，严禁交错排列。`,
      );
    } else if (pointCount > 6) {
      problems.push(`本页版式是 comparison，要点达 ${pointCount} 条，两侧各最多 3 条，请精简到 A/B 各 2~3 条。`);
    } else {
      const half = pointCount / 2;
      const ptText = (idx: number) => {
        const item = page.points?.[idx];
        return typeof item === "string" ? item : String(item?.text ?? "");
      };
      const paired = Array.from({ length: half }, (_, k) => captionOverlap(ptText(k), ptText(half + k)));
      if (paired.every((v) => v >= 0.6)) {
        problems.push(
          `本页 comparison 要点被 A/B 逐对交错排列了（第 k 条与第 ${half}+k 条内容几乎相同，左右两栏会渲染成一模一样）。请改用 sides 结构分组（"sides":{"a":{...},"b":{...}}），或按 [A1, A2, B1, B2] 先 A 后 B 排列，严禁 [A1, B1, A2, B2] 式交错。`,
        );
      }
    }
  }
  if (page.layout === "three_card" && pointCount !== 3) {
    problems.push(
      `本页版式是 three_card（三卡片），要点应为恰好 3 个（现在 ${pointCount} 个）。若多于 3 个，请把多余的一条并入卡片正文或删掉。`,
    );
  }

  if (page.pageIndex === 0) {
    const capCount = (page.captions ?? []).length;
    const narrLen = (page.narration || "").length;
    if (capCount > 2 || narrLen > 60) {
      problems.push(
        `封面页信息过载：当前 ${capCount} 条字幕、旁白 ${narrLen} 字（约 ${Math.ceil(narrLen / 5)} 秒）。封面只做总览式开场：字幕 1~2 条、旁白 ≤ 50 字，一句话点主题+一句悬念钩子即可，不要展开任何具体数字、结论或细节。`,
      );
    }
    if (pointCount > 2) {
      problems.push(
        `封面页 points 达 ${pointCount} 条（渲染为封面副标题一行）。封面副标题最多 2 条短句，请删减到 1~2 条，把要点留给内容页。`,
      );
    }
  }

  const icons = (page.points ?? []).map((x) => (typeof x === "string" ? null : x.icon)).filter(Boolean) as string[];
  if (icons.length >= 3 && new Set(icons).size === 1) {
    problems.push(
      `本页 ${icons.length} 个要点全部使用图标 "${icons[0]}"，请按各要点语义分别选择更贴切的图标，尽量互不重复。`,
    );
  }

  const capCount = (page.captions ?? []).length;
  const anchors = (page.points ?? []).map((x) => (typeof x === "string" ? undefined : x.anchor));
  const usedAnchors = anchors.filter((a): a is number => a !== undefined);
  if (usedAnchors.length && capCount) {
    if (usedAnchors.some((a) => a >= capCount)) {
      problems.push(
        `本页要点 anchor 越界：本页共 ${capCount} 条字幕（合法 anchor 为 0~${capCount - 1}），但出现了 anchor=${Math.max(...usedAnchors)}。请把 anchor 重新映射到字幕范围内，否则多个要点会挤在同一瞬间弹出、与解说错位。`,
      );
    }
    // 必须按「原始顺序」判断单调性：先排序再比较等于自比，永远不会触发（曾是死代码）
    if (usedAnchors.some((a, i) => i > 0 && a < usedAnchors[i - 1])) {
      problems.push(
        `本页要点 anchor 顺序错乱（出现后面的要点 anchor 小于前面的）：${usedAnchors.join(",")}。请改成单调不减，让要点按解说顺序依次入场。`,
      );
    }
  }
  return problems;
}

const ART_TIER_LIMIT = 6;

export function collectStoryboardWarnings(
  storyboard: {
    pages: {
      pageIndex: number;
      title: string;
      points?: unknown[];
      layout?: string | null;
      art?: string | null;
      chart?: unknown;
      table?: unknown;
    }[];
  },
  plan?: Plan | null,
): string | null {
  const dense: string[] = [];
  for (const p of storyboard.pages) {
    const n = (p.points ?? []).length;
    if (n > ART_TIER_LIMIT) {
      dense.push(`第 ${p.pageIndex + 1} 页「${p.title}」要点达 ${n} 条，层级可能过密`);
    }
  }
  const deviated: string[] = [];
  const missed: string[] = [];
  if (plan?.pages?.length) {
    for (const p of storyboard.pages) {
      const block = plan.pages[p.pageIndex];
      if (!block) continue;
      if (block.layout && block.layout !== p.layout) {
        deviated.push(
          `第 ${p.pageIndex + 1} 页大纲版式为 "${block.layout}"，实际展开为 "${p.layout}"（通常是该页生成了 customSvg 结构图接管了版式）`,
        );
      } else if (block.art && !p.art) {
        deviated.push(`第 ${p.pageIndex + 1} 页大纲 art="${block.art}" 未生效（被 customSvg 结构图接管）`);
      }
      if (block.layout === "chart" && !p.chart)
        missed.push(`第 ${p.pageIndex + 1} 页为图表版式（layout=chart）但未生成图表`);
      if (block.layout === "table" && !p.table)
        missed.push(`第 ${p.pageIndex + 1} 页为表格版式（layout=table）但未生成表格`);
    }
  }
  const parts: string[] = [];
  if (dense.length) parts.push(`部分页要点过多（已自动排布，建议精简）：${dense.join("；")}。`);
  if (deviated.length) parts.push(`部分页与已确认大纲存在版式偏差：${deviated.join("；")}。`);
  if (missed.length)
    parts.push(`部分页未兑现已确认大纲的图表/表格规划：${missed.join("；")}（可在分镜预览中对该页「重新生成」）。`);
  return parts.length ? parts.join("") : null;
}
