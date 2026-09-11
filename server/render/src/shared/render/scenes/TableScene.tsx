import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FS, RADIUS, CARD_SHADOW, ACCENT_GRAD, springIn } from "../theme";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import type { SceneProps } from "./types";

function estimateColWidths(headers: string[], rows: string[][], canvasWidth: number, isPortrait: boolean): number[] {
  const charW = FS.body;
  const padX = isPortrait ? 40 : 48;
  const minW = isPortrait ? 220 : 180;
  const maxW = isPortrait ? 600 : 520;
  const avail = canvasWidth - (isPortrait ? 40 : 160);
  const calc = (coef: number) =>
    headers.map((_, ci) => {
      const texts = [headers[ci], ...rows.map((r) => r[ci] ?? "")];
      const longest = Math.max(1, ...texts.map((s) => String(s).length));
      const unit = ci === 0 ? FS.caption : charW;
      return Math.max(minW, Math.min(maxW, padX + longest * unit * coef));
    });
  const need = calc(1.0);
  let total = need.reduce((a, b) => a + b, 0);
  if (total <= avail) return need;
  const need2 = calc(0.8);
  total = need2.reduce((a, b) => a + b, 0);
  if (total <= avail) return need2;
  const scale = avail / total;
  const scaled = need2.map((w) => Math.max(minW, Math.round(w * scale)));
  total = scaled.reduce((a, b) => a + b, 0);
  if (total <= avail) return scaled;
  const s2 = avail / total;
  return scaled.map((w) => Math.max(minW, Math.round(w * s2)));
}

export const TableScene: React.FC<SceneProps> = ({ page }) => {
  const title = page.title;
  const headers = page.table!.headers;
  const rows = page.table!.rows;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, height } = useResponsive();
  const timing = useSceneTiming();
  const o = springIn(f, fps, timing.frameAt(0), page.motion);
  const minCellH = isPortrait ? sp(80) : 66;
  const DESIGN_WIDTH = isPortrait ? contentWidth : 1920;
  const colWidths = estimateColWidths(headers, rows, DESIGN_WIDTH, isPortrait);
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const startX = (DESIGN_WIDTH - totalW) / 2;
  const startY = isPortrait ? (height - (1 + rows.length) * minCellH) / 2 : 250;
  const headerCellStyle = (i: number): React.CSSProperties => ({
    flex: `0 0 ${colWidths[i]}px`,
    minHeight: minCellH,
    background: i === 0 ? "rgba(255,255,255,0.18)" : "transparent",
    color: "#fff",
    fontSize: isPortrait ? fs(i === 0 ? FS.caption : FS.body) : (i === 0 ? FS.caption : FS.body),
    fontWeight: 800,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${isPortrait ? sp(8) : 8}px ${isPortrait ? sp(12) : 12}px`,
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.3,
    opacity: o,
  });
  const dataCellStyle = (ci: number, ry: number, zebra: boolean): React.CSSProperties => ({
    flex: `0 0 ${colWidths[ci]}px`,
    minHeight: minCellH,
    background: ci === 0 ? "rgba(59,111,245,0.08)" : zebra ? "#f7f9fd" : "#ffffff",
    color: ci === 0 ? C.accent : C.ink,
    fontSize: isPortrait ? fs(ci === 0 ? FS.caption : FS.body) : (ci === 0 ? FS.caption : FS.body),
    fontWeight: ci === 0 ? 800 : 600,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: ci === 0 ? "center" : "flex-start",
    textAlign: ci === 0 ? "center" : "left",
    padding: `${isPortrait ? sp(10) : 10}px ${isPortrait ? sp(14) : 14}px`,
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.35,
    opacity: ry,
    transform: `translateY(${(1 - ry) * 18}px)`,
  });
  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: isPortrait ? sp(120) : 120, fontSize: isPortrait ? fs(FS.title) : FS.title, fontWeight: 800, color: C.ink, fontFamily: FONT }}>{title}</div>
      <div style={{
        position: "absolute",
        top: startY,
        left: startX,
        width: totalW,
        background: "rgba(255,255,255,0.92)",
        borderRadius: RADIUS.box,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
        border: "1px solid rgba(59,111,245,0.10)",
      }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", background: ACCENT_GRAD }}>
          {headers.map((h, i) => (
            <div key={`h${i}`} style={headerCellStyle(i)}>{h || ""}</div>
          ))}
        </div>
        {rows.map((r, ri) => {
          const rowStart = timing.frameAt(ri, 4, 8);
          const ry = interpolate(f, [rowStart, rowStart + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const zebra = ri % 2 === 1;
          return (
            <div key={`r${ri}`} style={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
              {r.map((cell, ci) => (
                <div key={`c${ri}-${ci}`} style={dataCellStyle(ci, ry, zebra)}>{cell}</div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};