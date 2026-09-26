import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, FW, LH, RADIUS, BORDER, CARD_SHADOW, SOLID_SHADOW, SPACE, GLASS, CARD_TYPE, pickCardFont, accentOf, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const FlowScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const captionTexts = page.sentences && page.sentences.length
    ? page.sentences.map((s) => s.text)
    : page.captions ?? [];
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();
  const list = items;

  const n = Math.max(1, list.length);

  const CARD_PAD = isPortrait ? sp(CARD_TYPE.padX) : CARD_TYPE.padX;
  const CARD_PAD_Y = isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY;
  const ARROW_W = isPortrait ? sp(52) : 52;
  const ROW_GAP = isPortrait ? sp(CARD_TYPE.gapY) : CARD_TYPE.gapY;
  const SIDE_PAD = isPortrait ? sp(90) : 90;
  const availW = isPortrait ? contentWidth : 1920 - SIDE_PAD * 2;
  const MIN_NODE_W = isPortrait ? sp(150) : 150;
  const MAX_NODE_W = isPortrait ? sp(560) : 560;
  const MAX_PER_ROW = isPortrait ? 4 : 8;
  const MAX_ROWS = isPortrait ? 6 : 3;

  const rows = isPortrait ? n : Math.min(MAX_ROWS, Math.max(1, Math.ceil(n / 6)));
  const perRow = isPortrait ? 1 : Math.min(MAX_PER_ROW, Math.max(1, Math.ceil(n / rows)));
  const nodeW = Math.max(MIN_NODE_W, Math.min(MAX_NODE_W, (availW - (perRow - 1) * ARROW_W) / perRow));
  const ICON_SIDE = (isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox) + (isPortrait ? sp(16) : 16);
  const TEXT_W = Math.max(60, nodeW - CARD_PAD * 2 - ICON_SIDE);
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));

  const BODY_H = isPortrait ? 1500 : 760 - captionReserve;
  const maxCardH = Math.floor(BODY_H / rows) - ROW_GAP;

  const ICON_BLOCK = isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox;
  const V_PAD = (isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY) * 2;
  const LINE_H = CARD_TYPE.lineHeight;
  const MAX_LINES = CARD_TYPE.maxLines;
  const FS_CANDIDATES = CARD_TYPE.fsCandidates;

  const contentAvailH = Math.max(ICON_BLOCK, maxCardH - V_PAD);
  const nodeFs = pickCardFont(maxChars, TEXT_W, contentAvailH);
  const perLine = Math.max(1, Math.floor((TEXT_W * 0.95) / nodeFs));
  const lines = Math.ceil(maxChars / perLine);
  const textH = Math.ceil(lines * nodeFs * LINE_H);
  const cardH = isPortrait ? maxCardH : Math.min(Math.max(150, Math.max(ICON_BLOCK, textH) + V_PAD), maxCardH);
  const iconSize = isPortrait ? sp(CARD_TYPE.iconSize) : CARD_TYPE.iconSize;
  const ICON_GAP = isPortrait ? sp(16) : 16;

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${SIDE_PAD}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${perRow}, ${nodeW}px)`, columnGap: ARROW_W, rowGap: ROW_GAP, justifyItems: "stretch", justifyContent: "center" }}>
          {list.map((it, i) => {
            const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
            const a = accentOf(i);
            const showArrow = i < n - 1 && (i + 1) % perRow !== 0;
            return (
              <div key={i} style={{ position: "relative", opacity: o, transform: `translateY(${interpolate(o, [0, 1], [24, 0])}px)` }}>
                <div style={{
                  position: "relative",
                  background: `linear-gradient(165deg, ${a} 0%, ${a}d9 60%, ${a}bf 100%)`, color: "#fff", borderRadius: RADIUS.box,
                  padding: `${CARD_PAD_Y}px ${CARD_PAD}px`,
                  fontSize: nodeFs, fontWeight: FW.bold, width: nodeW, height: cardH,
                  fontFamily: FONT, lineHeight: CARD_TYPE.lineHeight, boxShadow: SOLID_SHADOW,
                  display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start", gap: ICON_GAP,
                  overflow: "hidden", boxSizing: "border-box",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
                  <span style={{
                    width: isPortrait ? sp(52) : 52, height: isPortrait ? sp(52) : 52, borderRadius: RADIUS.chip,
                    background: "rgba(255,255,255,0.24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon name={pointIcon(it, i)} size={iconSize} color="#fff" />
                  </span>
                  <span style={{
                    flex: 1, minWidth: 0, textAlign: "left", wordBreak: "break-word", position: "relative",
                    alignSelf: "center", paddingRight: isPortrait ? sp(4) : 4,
                  }}>{pointText(it, i)}</span>
                </div>
                {showArrow && (
                  <div style={{ position: "absolute", left: "100%", top: 0, bottom: 0, width: ARROW_W, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={Math.round(ARROW_W * 0.62)} height={isPortrait ? sp(28) : 28} viewBox="0 0 40 24" fill="none">
                      <path d="M2 12 H30" stroke={a} strokeWidth={4} strokeLinecap="round" />
                      <path d="M24 4 L34 12 L24 20" stroke={a} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const LoopScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const list = items;

  const titleChars = Array.from(title).length;
  const titleLines = titleChars > 14 ? 2 : 1;
  const HEADER_BOTTOM = 90 + (titleLines === 2 ? 170 : 110);
  const BOTTOM_SAFE = isPortrait ? contentHeight : 1080 - 80;

  const CX = isPortrait ? contentWidth / 2 : 960;
  const CY = (HEADER_BOTTOM + BOTTOM_SAFE) / 2;

  const N = Math.max(1, list.length);

  const BASE_NODE_W = isPortrait ? sp(345) : 345;
  const nodeW = Math.max(isPortrait ? sp(210) : 210, BASE_NODE_W - Math.max(0, N - 4) * (isPortrait ? sp(20) : 20));
  const TEXT_W = Math.max(80, nodeW - (isPortrait ? sp(80) : 80));
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const FS_CANDIDATES = [32, 28, 24, 20];
  const MAX_LINES = 3;
  const nodeFs = FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / fsz))) <= MAX_LINES) ?? 20;
  const lines = Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / nodeFs)));
  const nodeH = Math.min(isPortrait ? sp(260) : 260, Math.max(isPortrait ? sp(116) : 116, Math.ceil(lines * nodeFs * 1.4) + (isPortrait ? sp(32) : 32)));

  const RY = (BOTTOM_SAFE - HEADER_BOTTOM) / 2 - nodeH / 2 - (isPortrait ? sp(24) : 24);
  const RX = isPortrait
    ? Math.max(nodeW / 2 + (isPortrait ? sp(105) : 105), contentWidth / 2 - nodeW / 2 - (isPortrait ? sp(30) : 30))
    : Math.min(900 - nodeW / 2 - 30, Math.max(RY + 120, nodeW / 2 + 105));

  return (
    <AbsoluteFill>
      <PageHeading text={title} />
      <svg
        width={RX * 2}
        height={RY * 2}
        style={{ position: "absolute", left: CX - RX, top: CY - RY, opacity: 0.5 }}
      >
        <ellipse
          cx={RX}
          cy={RY}
          rx={RX - 6}
          ry={RY - 6}
          fill="none"
          stroke="rgba(59,111,245,0.7)"
          strokeWidth={4}
          strokeDasharray="14 12"
        />
      </svg>
      <div style={{ position: "absolute", left: CX - (isPortrait ? sp(90) : 90), top: CY - (isPortrait ? sp(90) : 90), width: isPortrait ? sp(180) : 180, height: isPortrait ? sp(180) : 180, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW }}>
        <div style={{ width: isPortrait ? sp(64) : 64, height: isPortrait ? sp(64) : 64, borderRadius: "50%", background: "#fff" }} />
      </div>
      <div style={{ position: "absolute", left: CX - (isPortrait ? sp(30) : 30), top: CY - (isPortrait ? sp(30) : 30), width: isPortrait ? sp(60) : 60, height: isPortrait ? sp(60) : 60, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW }}>
        <span style={{ color: "#fff", fontSize: isPortrait ? fs(FS.label) : FS.label, fontWeight: FW.heavy, fontFamily: FONT }}>循环</span>
      </div>
      {list.map((it, i) => {
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
        const x = CX + Math.cos(a) * RX;
        const y = CY + Math.sin(a) * RY;
        const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
        const ac = accentOf(i);
        return (
          <div key={i} style={{ position: "absolute", left: x - nodeW / 2, top: y, width: nodeW, height: nodeH, transform: "translateY(-50%)", opacity: o }}>
            <div style={{ position: "relative", width: nodeW, height: "100%", background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: RADIUS.box, display: "flex", alignItems: "center", justifyContent: "center", gap: isPortrait ? sp(10) : 10, padding: `${isPortrait ? sp(12) : 12}px ${isPortrait ? sp(16) : 16}px`, fontFamily: FONT, boxShadow: CARD_SHADOW, boxSizing: "border-box" }}>
            <Icon name={pointIcon(it, i)} size={isPortrait ? sp(26) : 26} color={ac} />
            <span style={{ fontSize: nodeFs, fontWeight: FW.bold, color: C.ink, textAlign: "center", lineHeight: LH.tight, flex: 1, wordBreak: "break-word" }}>{pointText(it, i)}</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PyramidScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const chart = page.chart;
  const labels = chart?.type === "pyramid" ? chart.labels : [];
  const chartVals = chart?.type === "pyramid" ? chart.values : [];
  const extractVal = (s: string): number | null => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*[%％倍xX]?/);
    return m ? parseFloat(m[1]) : null;
  };
  const tiers = labels.length >= 2 ? labels : page.points.map((t, i) => pointText(t, i));
  const N = Math.max(1, tiers.length);
  const rawVals = chartVals.length >= 2
    ? chartVals
    : tiers.map((t) => extractVal(t));
  const vals = rawVals.map((v, i) => (v !== null && Number.isFinite(v) && v > 0 ? v : Math.max(1, 100 - i * 20)));
  const maxVal = Math.max(...vals);

  const titleChars = Array.from(title).length;
  const titleLines = titleChars > 14 ? 2 : 1;
  const HEADER_BOTTOM = 90 + (titleLines === 2 ? 170 : 110);

  const MAX_W = isPortrait ? contentWidth : 1920 - 120 * 2;
  const MIN_W = isPortrait ? sp(420) : 420;
  const widths = vals.map((v) => {
    const ratio = v / maxVal;
    return Math.max(MIN_W, Math.round(MAX_W * ratio));
  });

  const cols = vals.map((v) => {
    const r = (v - Math.min(...vals)) / Math.max(1, maxVal - Math.min(...vals));
    const from = [59, 111, 245], to = [212, 225, 255];
    const c = from.map((_, idx) => Math.round(to[idx] + (from[idx] - to[idx]) * r));
    return `linear-gradient(135deg,rgb(${c[0]},${c[1]},${c[2]}),rgb(${Math.min(255, c[0] + 40)},${Math.min(255, c[1] + 40)},${Math.min(255, c[2] + 30)}))`;
  });

  const minW = Math.min(...widths);
  const topPad = isPortrait ? sp(64) : 64;
  const topAvailW = minW - topPad;
  const maxChars = Math.max(1, ...tiers.map((t, i) => Array.from(typeof t === "string" ? t : pointText(t, i)).length));
  const FS_CANDIDATES = [FS.heading, 32, 28, 25, 22];
  const nodeFs = FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(topAvailW / fsz))) <= 2) ?? 22;

  const lines = Math.ceil(maxChars / Math.max(1, Math.floor(topAvailW / nodeFs)));
  const naturalH = lines * nodeFs * 1.4 + 44;
  const availH = (isPortrait ? contentHeight : 1080) - HEADER_BOTTOM - 90 - (N - 1) * SPACE.md;
  const perTierH = Math.floor(availH / N);
  const tierMinH = isPortrait ? perTierH : Math.min(naturalH, perTierH);

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `${isPortrait ? sp(30) : 30}px 0` }}>
        {tiers.map((t, i) => {
          const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(t), i, 30), page.motion);
          const isTop = i === 0;
          const label = typeof t === "string" ? t : pointText(t, i);
          const icon = typeof t === "string" ? "layers" : pointIcon(t, i);
          return (
            <div key={i} style={{ opacity: o, transform: `scale(${interpolate(o, [0, 1], [0.9, 1], { output: "perceptual-scale" })})`, width: widths[i], minWidth: MIN_W, minHeight: tierMinH, padding: `${isPortrait ? sp(14) : 14}px ${isPortrait ? sp(32) : 32}px`, marginBottom: i === N - 1 ? 0 : Math.min(SPACE.md, Math.max(8, SPACE.md - (N - 4) * 4)), background: cols[i], color: isTop ? "#fff" : "#1a2b4a", borderRadius: RADIUS.box, display: "flex", alignItems: "center", justifyContent: "center", gap: isPortrait ? sp(16) : 16, fontSize: nodeFs, fontWeight: FW.heavy, fontFamily: FONT, lineHeight: 1.4, boxShadow: CARD_SHADOW }}>
              <Icon name={icon} size={Math.max(24, Math.round(nodeFs * 0.9))} color={isTop ? "#fff" : "#3b6ff5"} />
              <span style={{ textAlign: "center" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const TimelineScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const list = items;

  const SIDE_SAFE = 60;
  const nodeSlot = (1920 - SIDE_SAFE * 2) / Math.max(1, list.length);
  const NODE_W = isPortrait
    ? contentWidth
    : Math.max(260, Math.min(400, Math.round(nodeSlot * 0.92)));
  const TEXT_W = NODE_W - (isPortrait ? sp(36) : 40);
  const FIRST_CX = NODE_W / 2 + SIDE_SAFE;
  const LAST_CX = 1920 - NODE_W / 2 - SIDE_SAFE;
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const TIMELINE_MAX_LINES = 3;
  const nodeFs = pickCardFont(maxChars, TEXT_W, TIMELINE_MAX_LINES * CARD_TYPE.fsCandidates[0] * CARD_TYPE.lineHeight);

  const lines = Math.ceil(maxChars / Math.max(1, Math.floor((TEXT_W * 0.95) / nodeFs)));
  const textH = lines * nodeFs * CARD_TYPE.lineHeight;
  const PORTRAIT_TOP = sp(40);
  const PORTRAIT_BOTTOM = 200;
  const PORTRAIT_ROW_H = (contentHeight - PORTRAIT_TOP - PORTRAIT_BOTTOM) / Math.max(1, list.length);
  const PORTRAIT_NODE_W = contentWidth / 2 - sp(70);
  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, position: "relative" }}>
        {isPortrait ? (
          <div style={{ position: "absolute", top: PORTRAIT_TOP, bottom: PORTRAIT_BOTTOM, left: "50%", width: 8, transform: "translateX(-50%)", background: C.accent, borderRadius: 4 }} />
        ) : (
          /* 轴线两端与首尾节点的圆心严格对齐。 */
          <div style={{ position: "absolute", top: "50%", left: FIRST_CX, right: 1920 - LAST_CX, height: 8, transform: "translateY(-50%)", background: `linear-gradient(90deg, ${C.accent}, ${C.accent}cc)`, borderRadius: 4 }} />
        )}
        {isPortrait ? (
          <div style={{ position: "absolute", top: PORTRAIT_TOP, bottom: PORTRAIT_BOTTOM, left: 0, right: 0 }}>
            {list.map((it, i) => {
              const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
              const a = accentOf(i);
              const left = i % 2 === 0;
              const y = PORTRAIT_TOP + i * PORTRAIT_ROW_H + PORTRAIT_ROW_H / 2;
              return (
                <div key={i} style={{ position: "absolute", top: y, left: left ? 0 : "50%", width: PORTRAIT_NODE_W, transform: "translateY(-50%)", display: "flex", flexDirection: "row", alignItems: "center", gap: sp(16), opacity: o, justifyContent: left ? "flex-end" : "flex-start" }}>
                  <div style={{ width: sp(60), height: sp(60), borderRadius: "50%", background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, flexShrink: 0 }}>
                    <Icon name={pointIcon(it, i)} size={sp(32)} color="#fff" />
                  </div>
                  <div style={{ fontSize: nodeFs, fontWeight: FW.bold, color: C.ink, textAlign: left ? "right" : "left", fontFamily: FONT, lineHeight: CARD_TYPE.lineHeight, flex: 1 }}>{pointText(it, i)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}>
            {list.map((it, i) => {
              const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
              const a = accentOf(i);
              const below = i % 2 === 1;
              const cx = list.length === 1 ? 960 : FIRST_CX + i * ((LAST_CX - FIRST_CX) / (list.length - 1));
              return (
                <div key={i} style={{ position: "absolute", left: cx, top: "50%", transform: "translate(-50%, -50%)", width: NODE_W, opacity: o }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      height: textH, display: "flex", alignItems: "flex-end", justifyContent: "center",
                      marginBottom: 22, visibility: below ? "hidden" : "visible",
                    }}>
                      <div style={{ fontSize: nodeFs, fontWeight: FW.bold, color: C.ink, textAlign: "center", fontFamily: FONT, lineHeight: CARD_TYPE.lineHeight }}>
                        {!below ? pointText(it, i) : ""}
                      </div>
                    </div>
                    <div style={{ position: "relative", width: 60, height: 60, borderRadius: "50%", background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, flexShrink: 0 }}>
                      <Icon name={pointIcon(it, i)} size={32} color="#fff" />
                    </div>
                    <div style={{
                      height: textH, display: "flex", alignItems: "flex-start", justifyContent: "center",
                      marginTop: 22, visibility: below ? "visible" : "hidden",
                    }}>
                      <div style={{ fontSize: nodeFs, fontWeight: FW.bold, color: C.ink, textAlign: "center", fontFamily: FONT, lineHeight: CARD_TYPE.lineHeight }}>
                        {below ? pointText(it, i) : ""}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const QuadrantScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const list = items.slice(0, 4);
  const cells = [
    { r: "flex-start", c: "flex-start", a: C.accent },
    { r: "flex-start", c: "flex-end", a: "#34c79f" },
    { r: "flex-end", c: "flex-start", a: "#f2b03f" },
    { r: "flex-end", c: "flex-end", a: "#e868a4" },
  ];

  const TEXT_W = (isPortrait ? sp(550) : 550) - (isPortrait ? sp(26) : 26) * 2 - (isPortrait ? sp(24) : 24) * 2;
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const FS_CANDIDATES = [FS.body, 32, 28, 25, 22];
  const nodeFs = FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / fsz))) <= 2) ?? 22;

  const GRID_H = isPortrait ? 1000 : 680;
  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: isPortrait ? contentWidth : 1180, height: GRID_H }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: `${C.accent}66`, borderRadius: 2, transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, background: `${C.accent}66`, borderRadius: 2, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: isPortrait ? sp(SPACE.md) : SPACE.md, border: `${BORDER.accent}px solid ${C.accent}`, borderRadius: RADIUS.card, padding: isPortrait ? sp(SPACE.md) : SPACE.md }}>
          {list.map((it, i) => {
            const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
            return (
              <div key={i} style={{ opacity: o, height: "100%", background: GLASS.card, borderRadius: RADIUS.box, border: `${BORDER.card}px solid ${cells[i].a}`, display: "flex", alignItems: cells[i].r, justifyContent: cells[i].c, padding: isPortrait ? sp(24) : 24, boxShadow: CARD_SHADOW }}>
                <div style={{ display: "flex", alignItems: "center", gap: isPortrait ? sp(14) : 14, background: cells[i].a, color: "#fff", borderRadius: RADIUS.chip, padding: `${isPortrait ? sp(16) : 16}px ${isPortrait ? sp(22) : 22}px`, fontSize: nodeFs, fontWeight: FW.bold, fontFamily: FONT, textAlign: "center", lineHeight: 1.4, boxShadow: SOLID_SHADOW, width: TEXT_W, whiteSpace: "normal", overflow: "hidden", boxSizing: "border-box" }}>
                  <Icon name={pointIcon(it, i)} size={isPortrait ? sp(28) : 28} color="#fff" />
                  <span>{pointText(it, i)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </AbsoluteFill>
  );
};
