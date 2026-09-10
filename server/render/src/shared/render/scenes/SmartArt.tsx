import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, BORDER, CARD_SHADOW, SOLID_SHADOW, SPACE, ANIM, GLASS, accentOf, springIn } from "../theme";
import { Icon } from "../Icon";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon } from "../point";
import { useResponsive } from "../responsive";
import type { SceneProps } from "./types";

export const FlowScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const list = items;

  const n = Math.max(1, list.length);

  const CARD_PAD = isPortrait ? sp(28) : 28;
  const ARROW_W = isPortrait ? sp(52) : 52;
  const ROW_GAP = isPortrait ? sp(28) : 28;
  const SIDE_PAD = isPortrait ? sp(90) : 90;
  const availW = isPortrait ? contentWidth : 1920 - SIDE_PAD * 2;
  const MIN_NODE_W = isPortrait ? sp(150) : 150;
  const MAX_NODE_W = isPortrait ? sp(360) : 360;
  const MAX_PER_ROW = isPortrait ? 4 : 8;
  const MAX_ROWS = isPortrait ? 6 : 3;

  const rows = isPortrait ? n : Math.min(MAX_ROWS, Math.max(1, Math.ceil(n / 6)));
  const perRow = isPortrait ? 1 : Math.min(MAX_PER_ROW, Math.max(1, Math.ceil(n / rows)));
  const nodeW = Math.max(MIN_NODE_W, Math.min(MAX_NODE_W, (availW - (perRow - 1) * ARROW_W) / perRow));
  const TEXT_W = Math.max(60, nodeW - CARD_PAD * 2);
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));

  const BODY_H = isPortrait ? 1500 : 760;
  const maxCardH = Math.floor(BODY_H / rows) - ROW_GAP;

  const ICON_BLOCK = isPortrait ? sp(56) : 56;
  const V_PAD = (isPortrait ? sp(24) : 24) * 2;
  const LH = 1.45;
  const FS_CANDIDATES = [FS.body, 34, 30, 26, 22, 18];

  const pickFs = () => {
    for (const fsz of FS_CANDIDATES) {
      const perLine = Math.max(1, Math.floor(TEXT_W / fsz));
      const lns = Math.ceil(maxChars / perLine);
      if (lns > 4) continue;
      if (lns * fsz * LH + ICON_BLOCK + V_PAD <= maxCardH) return { fs: fsz, lns };
    }
    const fsz = FS_CANDIDATES[FS_CANDIDATES.length - 1];
    const perLine = Math.max(1, Math.floor(TEXT_W / fsz));
    return { fs: fsz, lns: Math.ceil(maxChars / perLine) };
  };
  const { fs: nodeFs, lns: lines } = pickFs();
  const cardH = isPortrait ? maxCardH : Math.min(Math.max(150, Math.ceil(lines * nodeFs * LH) + ICON_BLOCK + V_PAD), maxCardH);
  const iconSize = isPortrait ? sp(28) : 28;

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${SIDE_PAD}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${perRow}, ${nodeW}px)`, columnGap: ARROW_W, rowGap: ROW_GAP, justifyContent: "center" }}>
          {list.map((it, i) => {
            const o = springIn(f, fps, i * ANIM.stagger, page.motion);
            const a = accentOf(i);
            const showArrow = i < n - 1 && (i + 1) % perRow !== 0;
            return (
              <div key={i} style={{ position: "relative", opacity: o }}>
                <div style={{
                  background: `linear-gradient(180deg, ${a} 0%, ${a}cc 100%)`, color: "#fff", borderRadius: RADIUS.box,
                  padding: `${isPortrait ? sp(24) : 24}px ${CARD_PAD}px`, fontSize: nodeFs, fontWeight: 700, width: nodeW, height: cardH,
                  textAlign: "center", fontFamily: FONT, lineHeight: 1.4, boxShadow: SOLID_SHADOW,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: isPortrait ? sp(12) : 12,
                  overflow: "hidden", boxSizing: "border-box",
                }}>
                  <span style={{ width: isPortrait ? sp(48) : 48, height: isPortrait ? sp(48) : 48, borderRadius: RADIUS.chip, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={pointIcon(it, i)} size={iconSize} color="#fff" />
                  </span>
                  <span style={{ wordBreak: "break-word", flex: 1, display: "flex", alignItems: "center" }}>{pointText(it, i)}</span>
                </div>
                {showArrow && (
                  <div style={{ position: "absolute", left: "100%", top: 0, bottom: 0, width: ARROW_W, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isPortrait ? sp(40) : 40, color: a, fontWeight: 900, fontFamily: FONT }}>→</div>
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
        <span style={{ color: "#fff", fontSize: isPortrait ? fs(FS.label) : FS.label, fontWeight: 800, fontFamily: FONT }}>循环</span>
      </div>
      {list.map((it, i) => {
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
        const x = CX + Math.cos(a) * RX;
        const y = CY + Math.sin(a) * RY;
        const o = springIn(f, fps, i * ANIM.stagger, page.motion);
        const ac = accentOf(i);
        return (
          <div key={i} style={{ position: "absolute", left: x - nodeW / 2, top: y, width: nodeW, height: nodeH, transform: "translateY(-50%)", opacity: o }}>
            <div style={{ position: "relative", width: nodeW, height: "100%", background: GLASS.card, border: `${BORDER.card}px solid ${ac}`, borderRadius: RADIUS.box, display: "flex", alignItems: "center", justifyContent: "center", gap: isPortrait ? sp(10) : 10, padding: `${isPortrait ? sp(12) : 12}px ${isPortrait ? sp(16) : 16}px`, fontFamily: FONT, boxShadow: CARD_SHADOW, boxSizing: "border-box" }}>
            <Icon name={pointIcon(it, i)} size={isPortrait ? sp(26) : 26} color={ac} />
            <span style={{ fontSize: nodeFs, fontWeight: 700, color: C.ink, textAlign: "center", lineHeight: 1.35, flex: 1, wordBreak: "break-word" }}>{pointText(it, i)}</span>
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
          const o = springIn(f, fps, 30 + i * ANIM.stagger, page.motion);
          const isTop = i === 0;
          const label = typeof t === "string" ? t : pointText(t, i);
          const icon = typeof t === "string" ? "layers" : pointIcon(t, i);
          return (
            <div key={i} style={{ opacity: o, transform: `scale(${interpolate(o, [0, 1], [0.9, 1], { output: "perceptual-scale" })})`, width: widths[i], minWidth: MIN_W, minHeight: tierMinH, padding: `${isPortrait ? sp(14) : 14}px ${isPortrait ? sp(32) : 32}px`, marginBottom: i === N - 1 ? 0 : Math.min(SPACE.md, Math.max(8, SPACE.md - (N - 4) * 4)), background: cols[i], color: isTop ? "#fff" : "#1a2b4a", borderRadius: RADIUS.box, display: "flex", alignItems: "center", justifyContent: "center", gap: isPortrait ? sp(16) : 16, fontSize: nodeFs, fontWeight: 800, fontFamily: FONT, lineHeight: 1.4, boxShadow: CARD_SHADOW }}>
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
  const list = items;

  const NODE_W = isPortrait ? contentWidth : 300;
  const TEXT_W = NODE_W - (isPortrait ? sp(36) : 36);
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const FS_CANDIDATES = [FS.body, 32, 28, 25, 22];
  const nodeFs = FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / fsz))) <= 3) ?? 22;

  const lines = Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / nodeFs)));
  const textH = lines * nodeFs * 1.4;
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
          <div style={{ position: "absolute", top: "50%", left: 320, right: 320, height: 8, transform: "translateY(-50%)", background: C.accent, borderRadius: 4 }} />
        )}
        {isPortrait ? (
          <div style={{ position: "absolute", top: PORTRAIT_TOP, bottom: PORTRAIT_BOTTOM, left: 0, right: 0 }}>
            {list.map((it, i) => {
              const o = springIn(f, fps, i * ANIM.stagger, page.motion);
              const a = accentOf(i);
              const left = i % 2 === 0;
              const y = PORTRAIT_TOP + i * PORTRAIT_ROW_H + PORTRAIT_ROW_H / 2;
              return (
                <div key={i} style={{ position: "absolute", top: y, left: left ? 0 : "50%", width: PORTRAIT_NODE_W, transform: "translateY(-50%)", display: "flex", flexDirection: "row", alignItems: "center", gap: sp(16), opacity: o, justifyContent: left ? "flex-end" : "flex-start" }}>
                  <div style={{ width: sp(60), height: sp(60), borderRadius: "50%", background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, flexShrink: 0 }}>
                    <Icon name={pointIcon(it, i)} size={sp(32)} color="#fff" />
                  </div>
                  <div style={{ fontSize: nodeFs, fontWeight: 700, color: C.ink, textAlign: left ? "right" : "left", fontFamily: FONT, lineHeight: 1.4, flex: 1 }}>{pointText(it, i)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", padding: "0 340px", rowGap: 20 }}>
            {list.map((it, i) => {
              const o = springIn(f, fps, i * ANIM.stagger, page.motion);
              const a = accentOf(i);
              const below = i % 2 === 1;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: NODE_W, opacity: o }}>
                  {!below && (
                    <div style={{ marginBottom: 22, fontSize: nodeFs, fontWeight: 700, color: C.ink, textAlign: "center", fontFamily: FONT, lineHeight: 1.4, minHeight: textH }}>{pointText(it, i)}</div>
                  )}
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: a, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: CARD_SHADOW, flexShrink: 0 }}>
                    <Icon name={pointIcon(it, i)} size={32} color="#fff" />
                  </div>
                  {below && (
                    <div style={{ marginTop: 22, fontSize: nodeFs, fontWeight: 700, color: C.ink, textAlign: "center", fontFamily: FONT, lineHeight: 1.4, minHeight: textH }}>{pointText(it, i)}</div>
                  )}
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
            const o = springIn(f, fps, i * ANIM.stagger, page.motion);
            return (
              <div key={i} style={{ opacity: o, height: "100%", background: GLASS.card, borderRadius: RADIUS.box, border: `${BORDER.card}px solid ${cells[i].a}`, display: "flex", alignItems: cells[i].r, justifyContent: cells[i].c, padding: isPortrait ? sp(24) : 24, boxShadow: CARD_SHADOW }}>
                <div style={{ display: "flex", alignItems: "center", gap: isPortrait ? sp(14) : 14, background: cells[i].a, color: "#fff", borderRadius: RADIUS.chip, padding: `${isPortrait ? sp(16) : 16}px ${isPortrait ? sp(22) : 22}px`, fontSize: nodeFs, fontWeight: 700, fontFamily: FONT, textAlign: "center", lineHeight: 1.4, boxShadow: SOLID_SHADOW, width: TEXT_W, whiteSpace: "normal", overflow: "hidden", boxSizing: "border-box" }}>
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
