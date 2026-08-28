import type { StoryPage } from "../props";
import type { SceneRenderer, SceneMatch, BgResolver, SceneCtx } from "./types";
import { TitleScene } from "./TitleScene";
import { PointsScene } from "./PointsScene";
import { ChartScene, LineScene, PieScene, AreaScene, DonutScene, StackedBarScene, ScatterScene } from "./Charts";
import { SectionScene } from "./SectionScene";
import { ThreeCardScene } from "./ThreeCardScene";
import { ComparisonScene } from "./ComparisonScene";
import { EndScene } from "./EndScene";
import { FlowScene, LoopScene, TimelineScene, QuadrantScene, PyramidScene } from "./SmartArt";
import { TableScene } from "./TableScene";
import { QuoteScene } from "./QuoteScene";
import { CustomSvgScene } from "./CustomSvgScene";
import { MapScene } from "./MapScene";
import { TwoColumnScene } from "./TwoColumnScene";
import { StepsScene } from "./StepsScene";
import { StatsScene } from "./StatsScene";
import { QaScene } from "./QaScene";

interface SceneEntry {
  key: string;
  match: (page: StoryPage, ctx: SceneCtx) => boolean;
  render: SceneRenderer;
  bg: BgResolver;
}

const REGISTRY: SceneEntry[] = [
  { key: "title", match: (_p, { isFirst }) => isFirst, render: TitleScene, bg: "title" },
  { key: "custom_svg", match: (p) => !!p.customSvg && !p.chart && !p.table, render: CustomSvgScene, bg: "art" },
  { key: "flow", match: (p) => p.art === "flow", render: FlowScene, bg: "art" },
  { key: "loop", match: (p) => p.art === "loop", render: LoopScene, bg: "art" },
  { key: "timeline", match: (p) => p.art === "timeline", render: TimelineScene, bg: "art" },
  { key: "quadrant", match: (p) => p.art === "quadrant", render: QuadrantScene, bg: "art" },
  { key: "quote", match: (p) => p.art === "quote", render: QuoteScene, bg: "art" },
  { key: "map", match: (p) => p.layout === "map" && !!p.map, render: MapScene, bg: "art" },
  { key: "section", match: (p) => p.layout === "section", render: SectionScene, bg: "section" },
  { key: "three_card", match: (p) => p.layout === "three_card", render: ThreeCardScene, bg: "default" },
  { key: "two_column", match: (p) => p.layout === "two_column", render: TwoColumnScene, bg: "default" },
  { key: "steps", match: (p) => p.layout === "steps", render: StepsScene, bg: "default" },
  { key: "stats", match: (p) => p.layout === "stats", render: StatsScene, bg: "default" },
  { key: "qa", match: (p) => p.layout === "qa", render: QaScene, bg: "default" },
  { key: "table", match: (p) => !!p.table, render: TableScene, bg: "default" },
  { key: "comparison", match: (p) => p.layout === "comparison", render: ComparisonScene, bg: "default" },
  { key: "end", match: (p) => p.layout === "end", render: EndScene, bg: "end" },
  { key: "chart_line", match: (p) => p.chart?.type === "line", render: LineScene, bg: "chart" },
  { key: "chart_pie", match: (p) => p.chart?.type === "pie", render: PieScene, bg: "chart" },
  { key: "chart_pyramid", match: (p) => p.chart?.type === "pyramid", render: PyramidScene, bg: "chart" },
  { key: "chart_area", match: (p) => p.chart?.type === "area", render: AreaScene, bg: "chart" },
  { key: "chart_donut", match: (p) => p.chart?.type === "donut", render: DonutScene, bg: "chart" },
  { key: "chart_stacked_bar", match: (p) => p.chart?.type === "stacked-bar", render: StackedBarScene, bg: "chart" },
  { key: "chart_scatter", match: (p) => p.chart?.type === "scatter", render: ScatterScene, bg: "chart" },
  { key: "chart_bar", match: (p) => !!p.chart, render: ChartScene, bg: (p) => (p.chart && "values" in p.chart && p.chart.values.length <= 3 ? "chart" : "default") },
  { key: "points", match: () => true, render: PointsScene, bg: "default" },
];

const resolveBg = (resolver: BgResolver, page: StoryPage, ctx: SceneCtx): string =>
  typeof resolver === "function" ? resolver(page, ctx) : resolver;

export const matchScene = (page: StoryPage, isFirst: boolean): SceneMatch => {
  const ctx = { isFirst };
  const hit = REGISTRY.find((e) => e.match(page, ctx));
  return hit
    ? { render: hit.render, bg: resolveBg(hit.bg, page, ctx) }
    : { render: PointsScene, bg: "default" };
};