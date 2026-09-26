import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FW, RADIUS, CARD_TYPE, pickCardFont, accentOf, springIn } from "../theme";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { ICON_KEYS } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

const CARD_W = 440;
const CARD_H = 340;
const CARD_GAP = CARD_TYPE.gapX;

export const ThreeCardScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();

  const padX = isPortrait ? sp(CARD_TYPE.padX) : CARD_TYPE.padX;
  const padY = isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY;
  const textW = isPortrait ? contentWidth - padX * 2 : CARD_W - padX * 2;
  const ICON_BOX = isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox;
  const ICON_GAP = 18;
  const textAreaH = isPortrait
    ? sp(240)
    : CARD_H - padY * 2 - ICON_BOX - ICON_GAP;

  const pickFs = (s: string) => {
    const chosen = pickCardFont(Array.from(s).length, textW, textAreaH);
    return { fs: chosen, lh: CARD_TYPE.lineHeight, align: "left" as const, justify: "flex-start" as const };
  };
  const longest = items.length ? items.map((it, i) => pointText(it, i)).reduce((a, b) => (Array.from(a).length >= Array.from(b).length ? a : b)) : "…";
  const sc = pickFs(longest);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ position: "relative", display: "flex", flexDirection: isPortrait ? "column" : "row", gap: isPortrait ? sp(CARD_GAP) : CARD_GAP, marginTop: isPortrait ? sp(170) : 170 }}>
        {[0, 1, 2].map((i) => {
          const o = springIn(f, fps, resolveAnchor(timing, items[i] ? pointAnchor(items[i]) : undefined, i), page.motion);
          const t = items[i] ? pointText(items[i], i) : "…";
          const a = accentOf(i);
          return (
            <div key={i} style={{ position: "relative", opacity: o, transform: `translateY(${interpolate(o, [0, 1], [60, 0])}px)` }}>
              <Card accent={a} topBar style={{
                width: isPortrait ? contentWidth : CARD_W, height: isPortrait ? sp(CARD_H) : CARD_H,
                padding: `${padY}px ${padX}px`,
                boxSizing: "border-box",
              }}>
                <div style={{
                  flex: 1, width: "100%", display: "flex", flexDirection: "column",
                  alignItems: "flex-start", justifyContent: "center", gap: ICON_GAP,
                }}>
                  <div style={{
                    width: ICON_BOX, height: ICON_BOX, borderRadius: RADIUS.chip, background: `${a}1a`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: `0 2px 8px ${a}33`,
                  }}>
                    <Icon name={items[i] ? pointIcon(items[i], i) : ICON_KEYS[(i + 6) % ICON_KEYS.length]} size={isPortrait ? sp(CARD_TYPE.iconSize) : CARD_TYPE.iconSize} color={a} />
                  </div>
                  <div style={{
                    fontSize: sc.fs, fontWeight: FW.bold, color: C.ink, lineHeight: sc.lh, fontFamily: FONT,
                    textAlign: sc.align, width: "100%", position: "relative",
                  }}>
                    {sc.align === "left" && (
                      <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 5, borderRadius: RADIUS.pill, background: `linear-gradient(180deg, ${a}, ${a}55)` }} />
                    )}
                    <div style={{ paddingLeft: 16, paddingRight: 8 }}>{t}</div>
                  </div>
                </div>
              </Card>
              {i < 2 && (
                <div style={{
                  position: "absolute", top: isPortrait ? "100%" : "50%",
                  right: isPortrait ? "50%" : -(CARD_GAP / 2),
                  width: 40, height: 40,
                  transform: isPortrait ? "translate(50%, -50%)" : "translate(50%, -50%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: springIn(f, fps, resolveAnchor(timing, items[i] ? pointAnchor(items[i]) : undefined, i) + 6, page.motion),
                }}>
                  <svg width={34} height={22} viewBox="0 0 34 22" fill="none" style={{ transform: isPortrait ? "rotate(90deg)" : "none" }}>
                    <path d="M2 11 H24" stroke={a} strokeWidth={4} strokeLinecap="round" />
                    <path d="M18 4 L28 11 L18 18" stroke={a} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};