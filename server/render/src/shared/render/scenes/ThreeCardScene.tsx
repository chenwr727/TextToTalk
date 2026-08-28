import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, ANIM, accentOf, springIn, fitFontSizeBox } from "../theme";
import { Card } from "../Card";
import { ICON_KEYS } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import type { SceneProps } from "./types";

const CARD_W = 420;
const CARD_H = 360;
const CARD_GAP = 48;

export const ThreeCardScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const base = springIn(f, fps, 4, page.motion);

  const pickFs = (s: string) => {
    const fs = fitFontSizeBox(s, 338, 198, 28, 56, 700, 1.55);
    return { fs, lh: 1.55, align: "left" as const, justify: "flex-start" as const };
  };
  const longest = items.length ? items.map((it, i) => pointText(it, i)).reduce((a, b) => (Array.from(a).length >= Array.from(b).length ? a : b)) : "…";
  const sc = pickFs(longest);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ position: "relative", display: "flex", gap: CARD_GAP, marginTop: 170 }}>
        <div style={{
          position: "absolute", top: -30, left: -60, right: -60, bottom: -30,
          borderRadius: RADIUS.card,
          background: "linear-gradient(180deg, rgba(59,111,245,0.08) 0%, rgba(59,111,245,0) 100%)",
          opacity: base, pointerEvents: "none",
        }} />
        {[0, 1, 2].map((i) => {
          const o = springIn(f, fps, i * ANIM.stagger, page.motion);
          const t = items[i] ? pointText(items[i], i) : "…";
          const a = accentOf(i);
          return (
            <div key={i} style={{ position: "relative", opacity: o, transform: `translateY(${interpolate(o, [0, 1], [60, 0])}px)` }}>
              <Card accent={a} topBar icon={items[i] ? pointIcon(items[i], i) : ICON_KEYS[(i + 6) % ICON_KEYS.length]} style={{
                width: CARD_W, height: CARD_H, padding: "36px 32px",
              }}>
                <div style={{ position: "absolute", right: 10, bottom: -8, fontSize: 150, fontWeight: 900, lineHeight: 1, color: `${a}12`, fontFamily: FONT, pointerEvents: "none", letterSpacing: -6 }}>{i + 1}</div>
                <div style={{
                  fontSize: sc.fs, fontWeight: 700, color: C.ink, lineHeight: sc.lh, fontFamily: FONT,
                  textAlign: sc.align, display: "flex", alignItems: sc.justify, flex: 1, marginTop: 86,
                  width: "100%", overflow: "hidden", position: "relative",
                }}>
                  {sc.align === "left" && (
                    <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 5, borderRadius: RADIUS.pill, background: `linear-gradient(180deg, ${a}, ${a}55)` }} />
                  )}
                  <div style={{ paddingLeft: 16, paddingRight: 8, width: "100%" }}>{t}</div>
                </div>
                <div style={{ position: "absolute", left: 32, right: 32, bottom: 0, height: 5, borderRadius: "0 0 8px 8px", background: `linear-gradient(90deg, transparent 4%, ${a}99 50%, transparent 96%)`, opacity: 0.8 }} />
              </Card>
              {i < 2 && (
                <div style={{ position: "absolute", top: "50%", right: -40, width: 28, height: 28, transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", opacity: springIn(f, fps, i * ANIM.stagger + 6, page.motion) }}>
                  <div style={{ width: 11, height: 11, borderTop: `3px solid ${a}aa`, borderRight: `3px solid ${a}aa`, transform: "rotate(45deg)", borderRadius: 2 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};