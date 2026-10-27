import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, LH, FW, HEADER_OFFSET, SPACE, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { PageHeading } from "../PageHeading";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const QaScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const question = points[0] ? pointText(points[0], 0) : "";
  const answers = points.slice(1);

  const qO = springIn(f, fps, resolveAnchor(timing, points[0] ? pointAnchor(points[0]) : undefined, 0), page.motion);
  const a = accentOf(0);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ marginTop: isPortrait ? 0 : HEADER_OFFSET, width: isPortrait ? contentWidth : 1560 }}>
        <Card
          accent={a}
          topBar
          pad={isPortrait ? sp(34) : 34}
          style={{ opacity: qO, transform: `translateY(${interpolate(qO, [0, 1], [30, 0])}px)` }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: isPortrait ? sp(64) : 64,
                height: isPortrait ? sp(64) : 64,
                borderRadius: "50%",
                background: a,
                color: "#fff",
                fontSize: isPortrait ? fs(FS.heading) : FS.heading,
                fontWeight: FW.heavy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: isPortrait ? sp(28) : 28,
                flexShrink: 0,
                boxShadow: SOLID_SHADOW,
              }}
            >
              ?
            </div>
            <div
              style={{
                fontSize: isPortrait ? fs(FS.title) : FS.title,
                fontWeight: FW.heavy,
                color: C.ink,
                lineHeight: LH.tight,
                fontFamily: FONT,
              }}
            >
              {question}
            </div>
          </div>
        </Card>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isPortrait ? sp(24) : SPACE.md,
            marginTop: isPortrait ? sp(32) : SPACE.lg,
          }}
        >
          {answers.map((p, i) => {
            const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i + 1), page.motion);
            const ac = accentOf(i + 1);
            return (
              <Card
                key={i}
                accent={ac}
                leftBar
                pad={isPortrait ? sp(28) : 28}
                style={{ opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <IconTile
                    name={pointIcon(p, i + 1)}
                    accent={ac}
                    size="md"
                    style={{ marginRight: isPortrait ? sp(24) : SPACE.md }}
                  />
                  <div
                    style={{
                      fontSize: isPortrait ? fs(FS.body) : FS.body,
                      fontWeight: FW.regular,
                      color: C.ink,
                      lineHeight: LH.body,
                      fontFamily: FONT,
                    }}
                  >
                    {pointText(p, i + 1)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
