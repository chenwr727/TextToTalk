import type { StoryPage } from "../props";

export interface SceneProps {
  page: StoryPage;
  fps: number;
  subtitles: boolean;
  isFirst: boolean;
}

export type SceneRenderer = React.FC<SceneProps>;

export interface SceneCtx {
  isFirst: boolean;
}

export type BgResolver = string | ((page: StoryPage, ctx: SceneCtx) => string);

export interface SceneMatch {
  render: SceneRenderer;
  bg: string;
}

export interface PageBodyProps extends SceneProps {
  Scene: SceneRenderer;
}
