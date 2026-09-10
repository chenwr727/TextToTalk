import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, CONTENT_WIDTH, SPACE, RADIUS, BORDER, CARD_SHADOW, DOT_SHADOW, ANIM, accentOf, FS, GLASS, springIn } from "../theme";
import { Icon } from "../Icon";
import { pointText, pointIcon } from "../point";
import { HandHighlight } from "../rough";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";

export const PointsScene: React.FC<SceneProps> = ({ page }) => {
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();

  type Scale = {
    leadFs: number; subFs: number;
    leadPad: string; subPad: string;
    btnLead: number; btnSub: number;
    iconLead: number; iconSub: number;
    lineHeight: number;
    gap: number; rowMb: number; padTop: number;
  };
  const SCALES: Scale[] = [
    { leadFs: FS.hero, subFs: 56, leadPad: "44px 44px", subPad: "30px 36px", btnLead: 92, btnSub: 68, iconLead: 50, iconSub: 36, lineHeight: 1.35, gap: 28, rowMb: SPACE.lg, padTop: 260 },
    { leadFs: 72, subFs: 52, leadPad: "34px 38px", subPad: "24px 32px", btnLead: 84, btnSub: 64, iconLead: 44, iconSub: 34, lineHeight: 1.35, gap: 26, rowMb: SPACE.lg, padTop: 240 },
    { leadFs: 62, subFs: 44, leadPad: "28px 34px", subPad: "20px 28px", btnLead: 72, btnSub: 56, iconLead: 40, iconSub: 30, lineHeight: 1.35, gap: 22, rowMb: SPACE.md, padTop: 220 },
    { leadFs: 52, subFs: 38, leadPad: "22px 30px", subPad: "16px 24px", btnLead: 62, btnSub: 50, iconLead: 34, iconSub: 28, lineHeight: 1.3, gap: 18, rowMb: SPACE.sm, padTop: 200 },
  ];
  const scale: Scale = SCALES[Math.min(points.length + (isPortrait ? 1 : 0), SCALES.length) - 1] ?? SCALES[3];

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", overflow: "hidden" }}>
      <div style={{
        width: isPortrait ? contentWidth : CONTENT_WIDTH, maxWidth: isPortrait ? "100%" : "84%", fontFamily: FONT,
        paddingTop: isPortrait ? sp(scale.padTop) : scale.padTop,
        display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap,
      }}>
        {points.map((p, i) => {
          const s = springIn(f, fps, i * ANIM.stagger, page.motion);
          const a = accentOf(i);
          const isLead = i === 0 && points.length > 1;
          const fsz = isLead ? scale.leadFs : scale.subFs;
          const pad = isLead ? scale.leadPad : scale.subPad;
          const btn = isLead ? scale.btnLead : scale.btnSub;
          const ic = isLead ? scale.iconLead : scale.iconSub;
          return (
            <div key={i} style={{
              position: "relative",
              marginBottom: isPortrait ? sp(scale.rowMb) : scale.rowMb,
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
            }}>
              <div style={{
                position: "relative", display: "flex", alignItems: "center", padding: isPortrait ? pad.replace(/(\d+)px/g, (m, n) => `${sp(Number(n))}px`) : pad,
                background: GLASS.card, border: `${BORDER.card}px solid ${a}`, borderRadius: RADIUS.card, boxShadow: CARD_SHADOW,
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: isLead ? 10 : 6, background: `linear-gradient(180deg, ${a}, ${a}66)` }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
                <div style={{
                  marginRight: isPortrait ? sp(24) : 24, flexShrink: 0,
                  width: isPortrait ? sp(btn) : btn, height: isPortrait ? sp(btn) : btn, borderRadius: "50%",
                  background: `${a}1a`, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: DOT_SHADOW,
                }}>
                  <Icon name={pointIcon(p, i)} size={isPortrait ? sp(ic) : ic} color={a} />
                </div>
                <div style={{ fontSize: isPortrait ? fs(fsz) : fsz, fontWeight: isLead ? 800 : 600, color: C.ink, lineHeight: scale.lineHeight }}>
                  {isLead && page.effects?.annotation === "highlight" ? (
                    <HandHighlight color={a} progress={springIn(f, fps, ANIM.stagger + 6, page.motion)}>
                      {pointText(p, i)}
                    </HandHighlight>
                  ) : (
                    pointText(p, i)
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
