import React from "react";
import type { StoryPage as WebStoryPage } from "../types";
import type { StoryPage as RenderStoryPage } from "../../../server/render/src/shared/render/props";
import type { SceneRenderer } from "../../../server/render/src/shared/render/scenes/types";
import { matchScene } from "../../../server/render/src/shared/render/scenes/sceneRegistry";
import { Bg } from "../../../server/render/src/shared/render/Bg";
import { IconView } from "../../../server/render/src/shared/render/Icon";

const DESIGN_W = 1920;

export function RenderThumb({ p, isFirst, theme }: { p: WebStoryPage; isFirst: boolean; theme?: string }) {
  const rp = p as unknown as RenderStoryPage;
  const { render: Scene, bg } = matchScene(rp, isFirst);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="dsh-thumb">
      <div
        className="dsh-thumb-stage"
        style={{ transform: `scale(${scale})` }}
      >
        <Bg variant={bg} theme={theme as any} />
        <div className="dsh-thumb-layer">
          {!isFirst && rp.icon ? <IconView icon={rp.icon} /> : null}
          <SceneView Scene={Scene} page={rp} isFirst={isFirst} />
        </div>
      </div>
    </div>
  );
}

function SceneView({ Scene, page, isFirst }: { Scene: SceneRenderer; page: RenderStoryPage; isFirst: boolean }) {
  const El = Scene;
  return <El page={page} fps={30} subtitles={false} isFirst={isFirst} />;
}