import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/**
 * 氛围光（light leak / 光晕扫过）。
 *
 * 视频和网页最大的观感差距之一：真实拍摄的画面永远有"光"，而纯 CSS 版面永远干净均匀。
 * 这里用几层极软的彩色渐变做出片头那种"镜头光扫过"的味道。
 *
 * 混合模式的选择（踩过一次坑）：
 * - 彩色光雾必须用**普通混合**：screen 在浅色主题的近白底上几乎不产生变化，肉眼看等于没加。
 * - 只有白色高光条适合 screen：浅底上看不见正是对的，深色主题上才会亮起来。
 *
 * 全部由帧数驱动、无随机、无外部依赖，任意分段渲染结果一致。
 */
export const LightLeak: React.FC<{ strength?: number }> = ({ strength = 1 }) => {
  const f = useCurrentFrame();

  // 主光带从前侧扫过：前段快、后段慢，扫完停在画面外（不常驻，避免整页糊一层暖色）
  const sweep = interpolate(f, [0, 84], [-0.35, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(f, [0, 14, 70, 96], [0, 1, 1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 暖光晕缓慢呼吸，避免静止画面死板
  const breathe = 0.85 + 0.15 * Math.sin((f / 90) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 斜向彩色光带（普通混合，浅色主题上表现为暖色薄雾） */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          left: `${sweep * 100 - 30}%`,
          width: "58%",
          height: "160%",
          transform: "rotate(16deg)",
          opacity: 0.4 * strength * fade,
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,196,132,0.75) 30%, rgba(150,196,255,0.6) 56%, transparent 100%)",
          filter: "blur(52px)",
        }}
      />
      {/* 右上暖光 */}
      <div
        style={{
          position: "absolute",
          top: -240,
          right: -200,
          width: 940,
          height: 940,
          borderRadius: "50%",
          opacity: 0.3 * strength * breathe,
          background: "radial-gradient(circle, rgba(255,178,110,0.85) 0%, rgba(255,178,110,0) 66%)",
          filter: "blur(26px)",
        }}
      />
      {/* 左下冷光，压住整体偏黄 */}
      <div
        style={{
          position: "absolute",
          bottom: -280,
          left: -240,
          width: 900,
          height: 900,
          borderRadius: "50%",
          opacity: 0.24 * strength * breathe,
          background: "radial-gradient(circle, rgba(120,178,255,0.8) 0%, rgba(120,178,255,0) 68%)",
          filter: "blur(30px)",
        }}
      />
      {/* 镜面高光条：只有在深色主题上才会让画面"亮"起来 */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: `${12 + sweep * 68}%`,
          width: 4,
          height: "140%",
          transform: "rotate(18deg)",
          opacity: 0.22 * strength * fade,
          mixBlendMode: "screen",
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.95), transparent)",
          filter: "blur(7px)",
        }}
      />
    </AbsoluteFill>
  );
};
