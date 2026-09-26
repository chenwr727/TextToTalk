import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FW, LH, HEADER_OFFSET, CARD_SHADOW, GLASS, BORDER, accentOf, SOLID_SHADOW, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const TwoColumnScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const captionTexts = page.sentences && page.sentences.length
    ? page.sentences.map((s) => s.text)
    : page.captions ?? [];
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();
  const a = accentOf(0);

  const leftO = springIn(f, fps, resolveAnchor(timing, points[0] ? pointAnchor(points[0]) : undefined, 0), page.motion);
  const rightO = springIn(f, fps, resolveAnchor(timing, points[1] ? pointAnchor(points[1]) : undefined, 1), page.motion);

  const availH = isPortrait
    ? contentHeight - captionReserve
    : Math.max(360, 1080 - HEADER_OFFSET - captionReserve - 40);

  const boxW = isPortrait ? contentWidth : 1560;
  const leftW = isPortrait ? boxW : boxW * (1.2 / 2.2);

  const maxLen = points.reduce((m, p, i) => Math.max(m, [...pointText(p, i)].length), 0);
  const cardW = leftW - (isPortrait ? sp(30) : 30) * 2 - (isPortrait ? sp(64) : 64) - (isPortrait ? sp(24) : 24);
  const byCountFs = points.length <= 2 ? 44 : points.length === 3 ? 40 : points.length === 4 ? 36 : 32;
  const estLines = Math.max(1, Math.ceil(maxLen / Math.max(6, Math.floor(cardW / (byCountFs * 1.05)))));
  const lenFactor = estLines <= 1 ? 1 : estLines === 2 ? 0.9 : estLines === 3 ? 0.8 : 0.72;
  const bodyFs = Math.max(24, Math.round(byCountFs * lenFactor * (isPortrait ? 1.05 : 1)));

  const gapOf = (fSize: number) => Math.max(12, Math.round(fSize * (isPortrait ? 0.62 : 0.66)));
  const padYOf = (fSize: number) => Math.max(14, Math.round(fSize * 0.66));
  const measureH = (fSize: number) => {
    const innerW = cardW - Math.round(fSize * 1.75) - (isPortrait ? sp(24) : 24);
    return points.reduce((sum, p, i) => {
      const lines = Math.max(1, Math.ceil([...pointText(p, i)].length / Math.max(4, Math.floor(innerW / (fSize * 1.05)))));
      return sum + lines * fSize * 1.4 + padYOf(fSize) * 2;
    }, 0) + gapOf(fSize) * Math.max(0, points.length - 1);
  };
  let finalFs = bodyFs;
  for (let guard = 0; guard < 12 && measureH(finalFs) > availH && finalFs > 20; guard++) {
    finalFs = Math.max(20, finalFs - 2);
  }

  const gap = gapOf(finalFs);
  const padY = padYOf(finalFs);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ display: "flex", flexDirection: isPortrait ? "column" : "row", gap: isPortrait ? sp(64) : 64, marginTop: isPortrait ? 0 : HEADER_OFFSET, marginBottom: isPortrait ? captionReserve : 0, width: boxW, alignItems: "center", maxHeight: isPortrait ? undefined : availH }}>
        <div style={{ flex: isPortrait ? undefined : 1.2, width: isPortrait ? boxW : undefined, maxHeight: isPortrait ? availH : undefined, display: "flex", flexDirection: "column", gap, justifyContent: "center", opacity: leftO, transform: `translateX(${interpolate(leftO, [0, 1], [-40, 0])}px)` }}>
          {points.map((p, i) => {
            const t = springIn(f, fps, resolveAnchor(timing, pointAnchor(p), i), page.motion);
            const ac = accentOf(i);
            const iconBox = Math.round(finalFs * 1.75);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", flexShrink: 0,
                padding: `${padY}px ${isPortrait ? sp(30) : 30}px`,
                background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: 20, boxShadow: CARD_SHADOW,
                opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{ width: iconBox, height: iconBox, borderRadius: 16, background: `${ac}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: isPortrait ? sp(24) : 24, flexShrink: 0 }}>
                  <Icon name={pointIcon(p, i)} size={Math.round(iconBox * 0.53)} color={ac} />
                </div>
                <div style={{ fontSize: finalFs, fontWeight: FW.bold, color: C.ink, lineHeight: LH.body, fontFamily: FONT }}>{pointText(p, i)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ flex: isPortrait ? undefined : 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: rightO, transform: `translateX(${interpolate(rightO, [0, 1], [40, 0])}px)` }}>
          <div style={{
            width: isPortrait ? Math.min(sp(560), Math.round(availH * 0.6)) : Math.min(420, Math.round(availH * 0.82)),
            height: isPortrait ? Math.min(sp(560), Math.round(availH * 0.6)) : Math.min(420, Math.round(availH * 0.82)),
            borderRadius: isPortrait ? sp(56) : 40, background: `linear-gradient(150deg, ${a}22, ${a}0a)`,
            border: `${BORDER.card}px solid ${a}55`, boxShadow: CARD_SHADOW,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: "48%", height: "48%", borderRadius: isPortrait ? 60 : 50, background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SOLID_SHADOW }}>
              <Icon name={pointIcon(points[0] ?? "", 0)} size={isPortrait ? sp(150) : 110} color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};