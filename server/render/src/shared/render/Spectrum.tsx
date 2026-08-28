import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { C } from "./theme";

export const Spectrum: React.FC<{ src: string; color?: string; barCount?: number; opacity?: number }> = ({
  src,
  color = C.accent,
  barCount = 64,
  opacity = 0.18,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(src);

  if (!audioData) {
    return null;
  }

  const frequencyData = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: barCount,
    optimizeFor: "speed",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none", opacity }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: "100%", paddingBottom: 40 }}>
        {frequencyData.map((v, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: `${Math.max(4, v * 100)}%`,
              background: color,
              borderRadius: 5,
              opacity: 0.5 + 0.5 * v,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};