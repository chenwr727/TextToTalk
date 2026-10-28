import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { alpha, C, FONT, FS, FW, TEXT_SHADOW, springIn } from "../theme";
import { firstPointText } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";

export const SectionScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const sub = firstPointText(page.points || []);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const t0 = timing.frameAt(0, 5);
  const o = springIn(f, fps, t0, page.motion);
  const g = interpolate(f, [t0, t0 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /*
   * 同心圆按真实画布比例排。
   *
   * 原来 viewBox 固定 16:9、竖屏用 `slice` 放大 1.78 倍，左右两条弧被画布直接切断
   * （实测左弧 x=5~31、右弧 x=1048~1074），最外圈只剩一小段弧，看着像脏点；
   * 横屏最外圈 r=540、cy=540 又正好与上下边相切。现在 viewBox 跟随画布方向，
   * 半径按短边的 0.46 封顶，三圈都完整落在画面内。
   */
  const vb = isPortrait ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  const cx = vb.w / 2;
  const cy = vb.h / 2;
  const rMax = Math.min(vb.w, vb.h) * 0.46;
  const rings = [0.55, 0.78, 1].map((k) => Math.round(rMax * k));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, opacity: 0.34 * g, overflow: "hidden" }}
      >
        <circle cx={cx} cy={cy} r={rings[0]} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.6} />
        <circle cx={cx} cy={cy} r={rings[1]} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.4} />
        <circle cx={cx} cy={cy} r={rings[2]} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.26} />
        {page.effects?.pathDraw ? (
          <CirclePath cx={cx} cy={cy} r={rings[0]} progress={springIn(f, fps, t0 + 8, page.motion)} color={C.accent} />
        ) : (
          <circle
            cx={cx}
            cy={cy}
            r={Math.round(rings[0] * 0.5)}
            fill={`${C.accentWash}`}
            stroke={C.accent}
            strokeWidth={2}
            opacity={0.4}
          />
        )}
      </svg>
      <div
        style={{
          fontSize: isPortrait ? fs(FS.caption) : FS.caption,
          letterSpacing: isPortrait ? sp(12) : 12,
          color: C.muted,
          fontWeight: FW.bold,
          marginBottom: sp(34),
          opacity: o,
        }}
      >
        SEGMENT
      </div>
      <div
        style={{
          fontSize: isPortrait ? fs(FS.display) : FS.display,
          fontWeight: FW.heavy,
          color: C.ink,
          textAlign: "center",
          maxWidth: isPortrait ? contentWidth : "80%",
          fontFamily: FONT,
          opacity: o,
          textShadow: TEXT_SHADOW,
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            marginTop: sp(30),
            fontSize: isPortrait ? fs(FS.heading) : FS.heading,
            color: C.sub,
            fontFamily: FONT,
            opacity: o,
            textWrap: "balance",
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

const CirclePath: React.FC<{ cx: number; cy: number; r: number; progress: number; color: string }> = ({
  cx,
  cy,
  r,
  progress,
  color,
}) => {
  // 用半径算路径起点，避免把 960/540/150 写死（竖屏 viewBox 变了就会画错位置）
  const d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.1} ${cy - r}`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={`${alpha(color, 5)}`}
      stroke={color}
      strokeWidth={2}
      opacity={0.4}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
    />
  );
};
