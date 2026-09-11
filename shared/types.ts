export type Tone = "formal" | "casual" | "energetic";
export type Granularity = "coarse" | "medium" | "fine";

export type PageRhythm = "anchor" | "dense" | "breathing";

export type TransitionType = "fade" | "slide-left" | "slide-right" | "zoom" | "none";

export type MotionStyle = "spring" | "linear" | "float";

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
  | "hook" | "familiar" | "puzzle" | "build"
  | "mechanism" | "scale" | "evidence" | "case"
  | "compare" | "why" | "action" | "end";

export type Layout = "title" | "section" | "points" | "three_card" | "comparison" | "chart" | "table" | "end" | "two_column" | "steps" | "stats" | "qa" | "map";

export type Art = "flow" | "loop" | "timeline" | "quadrant" | "quote";

export interface SvgElement {
  type: "circle" | "rect" | "ellipse" | "line" | "path" | "polygon" | "text";
  x?: number; y?: number; cx?: number; cy?: number; r?: number;
  width?: number; height?: number; rx?: number; ry?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  d?: string;
  points?: string;
  fill?: string; stroke?: string; strokeWidth?: number; opacity?: number;
  text?: string; fontSize?: number; fontWeight?: number;
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
  | "trend" | "chart" | "clock" | "scale" | "gear" | "bulb"
  | "question" | "alert" | "check" | "search" | "target" | "rocket"
  | "heart" | "shield" | "db" | "globe" | "book"
  | "bolt" | "star" | "flag" | "link" | "users" | "wallet" | "box"
  | "layers" | "code" | "pie" | "calendar" | "map" | "cloud" | "lock"
  | "eye" | "compass" | "home" | "award";

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
  transition?: TransitionType;
  motion?: MotionStyle;
  effects?: PageEffects;
  customSvg?: CustomSvgSpec;
  map?: MapSpec | null;
}

export interface Storyboard {
  projectTitle: string;
  arc?: string;
  pages: StoryPage[];
}

export type TaskStatus =
  | "GENERATING"
  | "REVIEWING"
  | "RENDERING"
  | "DONE"
  | "FAILED";

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