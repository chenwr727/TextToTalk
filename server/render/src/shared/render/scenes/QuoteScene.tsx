import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, FW, LH, LH_TIGHT, RADIUS, BORDER, PILL_SHADOW, TEXT_SHADOW, GLASS, springIn } from "../theme";
import { pointText } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";

export const QuoteScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const o = springIn(f, fps, timing.frameAt(0), page.motion);
  const quote = items[0] ? pointText(items[0], 0) : title;
  const author = items[1] ? pointText(items[1], 1) : "";
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ marginBottom: sp(20), opacity: o, color: C.accent, fontSize: isPortrait ? fs(220) : 220, fontWeight: FW.black, fontFamily: "Georgia, serif", lineHeight: LH_TIGHT, textShadow: TEXT_SHADOW, transform: `scale(${interpolate(o, [0, 1], [0.6, 1], { output: "perceptual-scale" })})` }}>
        “
      </div>
      <div style={{ maxWidth: isPortrait ? contentWidth : "78%", opacity: o, fontSize: isPortrait ? fs(FS.hero) : FS.hero, fontWeight: FW.heavy, color: C.ink, textAlign: "center", lineHeight: LH.body, fontFamily: FONT, padding: `${sp(10)}px ${sp(30)}px`, textShadow: TEXT_SHADOW }}>
        {quote}
      </div>
      {author && (
        <div style={{ marginTop: sp(40), opacity: o, padding: `${sp(12)}px ${sp(34)}px`, background: GLASS.pill, border: `${BORDER.card}px solid ${C.accent}`, borderRadius: RADIUS.pill, fontSize: isPortrait ? fs(FS.body) : FS.body, fontWeight: FW.bold, color: C.sub, fontFamily: FONT, boxShadow: PILL_SHADOW }}>
          —— {author}
        </div>
      )}
    </AbsoluteFill>
  );
};
