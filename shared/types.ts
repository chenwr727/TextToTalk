export type Tone = "formal" | "casual" | "energetic";
export type Granularity = "coarse" | "medium" | "fine";

export type PageRhythm = "anchor" | "dense" | "breathing";

export type TransitionType = "fade" | "slide-left" | "slide-right" | "zoom" | "none";

/**
 * 各类转场占用的帧数。
 * 渲染端（扣除总时长）、预览抽帧（定位每页起始帧）必须用同一份映射，
 * 否则会出现"音画总长对不上""预览帧取到上一页结尾"这类错位。
 */
export const TRANSITION_FRAME_MAP: Record<TransitionType, number> = {
  none: 1,
  fade: 12,
  "slide-left": 14,
  "slide-right": 14,
  zoom: 16,
};

export const transitionFramesOf = (t?: TransitionType | null): number =>
  TRANSITION_FRAME_MAP[(t ?? "fade") as TransitionType] ?? TRANSITION_FRAME_MAP.fade;

export type MotionStyle = "spring" | "linear" | "float";

/** 背景装饰强度：quiet 只保留渐变 + 网格，给信息密集页降噪 */
export type PageDecor = "full" | "quiet";

export interface PageEffects {
  annotation?: "highlight" | "underline" | "circle" | "none";
  pathDraw?: boolean;
  threeD?: boolean;
}

export interface VideoParams {
  width: number;
  height: number;
  fps: number;
  tone: Tone;
  narration: boolean;
  subtitles: boolean;
  bgm: "none" | "default";
  granularity: Granularity;
  theme?: string;
  audience?: string;
  coreMessage?: string;
  audienceOutcome?: string;
  voice?: string;
  engine?: string;
  ttsSpeed?: number;
  ttsVolume?: number;
  targetDurationSec?: number;
}

export type ChartSpec =
  | { type: "bar"; labels: string[]; values: number[]; title: string }
  | { type: "line"; labels: string[]; values: number[]; title: string }
  | { type: "pie"; labels: string[]; values: number[]; title: string; total?: number }
  | { type: "pyramid"; labels: string[]; values: number[]; title: string }
  | { type: "area"; labels: string[]; values: number[]; title: string }
  | { type: "donut"; labels: string[]; values: number[]; title: string; total?: number }
  | { type: "stacked-bar"; labels: string[]; series: { name: string; values: number[] }[]; title: string }
  | { type: "scatter"; points: { x: number; y: number; label?: string }[]; title: string }
  | null;

export interface TableSpec {
  headers: string[];
  rows: string[][];
}

export type PageRole =
  | "hook"
  | "familiar"
  | "puzzle"
  | "build"
  | "mechanism"
  | "scale"
  | "evidence"
  | "case"
  | "compare"
  | "why"
  | "action"
  | "end";

export type Layout =
  | "title"
  | "section"
  | "points"
  | "three_card"
  | "comparison"
  | "chart"
  | "table"
  | "end"
  | "two_column"
  | "steps"
  | "stats"
  | "qa"
  | "map"
  /** 受约束的生成式版式：AI 直接写一页 React 组件（只允许用白名单 Kit），由服务端校验后渲染 */ | "code";

export type Art = "flow" | "loop" | "timeline" | "quadrant" | "quote";

export interface SvgElement {
  type: "circle" | "rect" | "ellipse" | "line" | "path" | "polygon" | "text";
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  r?: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  d?: string;
  points?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textAnchor?: "start" | "middle" | "end";
  delay?: number;
  draw?: boolean;
  anchor?: number;
}

export type CustomSvgSpec = SvgElement[] | null;

export interface MapMarker {
  name: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
  anchor?: number;
}

export type MapRouteType = "rail" | "flight" | "road";

export interface MapRoute {
  from: number;
  to: number;
  color?: string;
  type?: MapRouteType;
  dashed?: boolean;
  animated?: boolean;
  flow?: boolean;
  anchor?: number;
}

export interface MapRegion {
  name?: string;
  points: string;
  color?: string;
  label?: string;
  anchor?: number;
}

export interface MapSpec {
  markers?: MapMarker[];
  routes?: MapRoute[];
  regions?: MapRegion[];
}

export type IconId =
  | "trend"
  | "chart"
  | "clock"
  | "scale"
  | "gear"
  | "bulb"
  | "question"
  | "alert"
  | "check"
  | "search"
  | "target"
  | "rocket"
  | "heart"
  | "shield"
  | "db"
  | "globe"
  | "book"
  | "bolt"
  | "star"
  | "flag"
  | "link"
  | "users"
  | "wallet"
  | "box"
  | "layers"
  | "code"
  | "pie"
  | "calendar"
  | "map"
  | "cloud"
  | "lock"
  | "eye"
  | "compass"
  | "home"
  | "award";

export interface PointItem {
  text: string;
  icon?: IconId | null;
  anchor?: number;
}
export type Point = string | PointItem;

export interface ComparisonSide {
  label: string;
  points: Point[];
}
export interface ComparisonSides {
  a: ComparisonSide;
  b: ComparisonSide;
}

export interface StoryPage {
  pageIndex: number;
  title: string;
  points: Point[];
  narration: string;
  captions: string[];
  chart: ChartSpec;
  layout?: Layout;
  art?: Art | null;
  role?: PageRole | null;
  icon?: IconId | null;
  table?: TableSpec | null;
  comparisonSides?: ComparisonSides | null;
  durationSec: number;
  rhythm?: PageRhythm;
  /** 页面主色：0~5 对应主题调色板的第几色，用于「这一章换色」；不给则用默认主色 */
  accent?: number;
  decor?: PageDecor;
  transition?: TransitionType;
  motion?: MotionStyle;
  effects?: PageEffects;
  customSvg?: CustomSvgSpec;
  map?: MapSpec | null;
  /** 生成式版式的整页源码（服务端已转译为纯 JS 并做过白名单校验） */
  code?: string;
}

export interface Storyboard {
  projectTitle: string;
  arc?: string;
  pages: StoryPage[];
}

export type TaskStatus = "GENERATING" | "REVIEWING" | "RENDERING" | "DONE" | "FAILED";

export interface Task {
  taskId: string;
  token: string;
  status: TaskStatus;
  prompt: string;
  params: VideoParams;
  storyboard: Storyboard | null;
  progress: number;
  error: string | null;
  warning: string | null;
  outputUrl: string | null;
  createdAt: number;
  updatedAt: number;
}
