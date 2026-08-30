import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Storyboard } from "../types.js";
import { renderDir } from "./runtime.js";

const RENDER_DIR = renderDir;

export function writeRenderEntry(
  taskId: string,
  storyboard: Storyboard,
  pages: any[],
  fps: number,
  subtitles: boolean,
  bgm: { audioUrl: string } | null,
  entryName?: string,
  opts?: { theme?: string; width?: number; height?: number }
): string {
  entryName = entryName || `gen_${taskId}`;
  const entryDir = path.join(RENDER_DIR, "src", "gen");
  mkdirSync(entryDir, { recursive: true });
  const entryPath = path.join(entryDir, `${entryName}.tsx`);

  const width = opts?.width || 1920;
  const height = opts?.height || 1080;
  const propsText = JSON.stringify({ projectTitle: storyboard.projectTitle, pages, fps, subtitles, bgm, theme: opts?.theme || "tech", width, height });
  const entry = `import { registerRoot, Composition } from "remotion";
import { DynamicVideo, TRANSITION_FRAMES } from "../DynamicVideo";
const props: any = ${propsText};
const frames = (props.pages || []).reduce((s: number, p: any) => {
  if (p && p.sentences && p.sentences.length) {
    return s + p.sentences.reduce((a: number, x: any) => a + Math.max(1, Math.round(x.seconds * (props.fps || 30))), 0);
  }
  return s + Math.round((p.durationSec || 4) * (props.fps || 30));
}, 1);
const transitionFrames = Math.max(0, (props.pages || []).length - 1) * TRANSITION_FRAMES;
const totalFrames = frames - transitionFrames;
export const RemotionRoot: React.FC = () => (
  <Composition
    id="DynamicVideo"
    component={DynamicVideo as any}
    durationInFrames={Math.max(30, totalFrames)}
    fps={props.fps || 30}
    width={props.width || 1920}
    height={props.height || 1080}
    defaultProps={props}
  />
);
registerRoot(RemotionRoot);
`;
  writeFileSync(entryPath, entry);
  return entryPath;
}