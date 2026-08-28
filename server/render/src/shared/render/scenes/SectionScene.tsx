import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, FONT, FS, TEXT_SHADOW, springIn } from "../theme";
import { firstPointText } from "../point";
import type { SceneProps } from "./types";

export const SectionScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const sub = firstPointText(page.points || []);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = springIn(f, fps, 5, page.motion);
  const g = interpolate(f, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.5 * g }}>
        <circle cx={960} cy={540} r={300} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.5} />
        <circle cx={960} cy={540} r={420} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.3} />
        <circle cx={960} cy={540} r={540} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.18} />
        {page.effects?.pathDraw ? (
          <CirclePath progress={springIn(f, fps, 8, page.motion)} color={C.accent} />
        ) : (
          <circle cx={960} cy={540} r={150} fill={`${C.accent}0d`} stroke={C.accent} strokeWidth={2} opacity={0.4} />
        )}
      </svg>
      <div style={{ fontSize: FS.caption, letterSpacing: 12, color: C.muted, fontWeight: 700, marginBottom: 34, opacity: o }}>SEGMENT</div>
      <div style={{ fontSize: 86, fontWeight: 800, color: C.ink, textAlign: "center", maxWidth: "80%", fontFamily: FONT, opacity: o, textShadow: TEXT_SHADOW }}>{title}</div>
      {sub && <div style={{ marginTop: 30, fontSize: FS.heading, color: C.sub, fontFamily: FONT, opacity: o }}>{sub}</div>}
    </AbsoluteFill>
  );
};

const CirclePath: React.FC<{ progress: number; color: string }> = ({ progress, color }) => {
  const d = "M 960 390 A 150 150 0 1 1 959.9 390";
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  return (
    <circle
      cx={960}
      cy={540}
      r={150}
      fill={`${color}0d`}
      stroke={color}
      strokeWidth={2}
      opacity={0.4}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
    />
  );
};
