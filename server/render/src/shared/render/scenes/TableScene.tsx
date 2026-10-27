import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FS, FW, HEADER_OFFSET, LH, ACCENT_GRAD, springIn } from "../theme";
import { useResponsive } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import { PageHeading } from "../PageHeading";
import { Card } from "../Card";
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
  const DESIGN_WIDTH = isPortrait ? contentWidth : 1920;
  const baseWidths = estimateColWidths(headers, rows, DESIGN_WIDTH, isPortrait);
  // 列宽只按「最长文字 + 内边距」估算，两列表格在 1920 画布上只剩中间一小块。
  // 这里按可用宽度把表格放大（只放大、不缩小，缩小逻辑已在 estimateColWidths 里），
  // 字号与行高也跟着放大，但上限更保守，避免行高失控。
  const availW = DESIGN_WIDTH - (isPortrait ? sp(40) : 160);
  const rawTotal = baseWidths.reduce((a, b) => a + b, 0) || 1;
  const fitW = Math.max(1, Math.min(1.9, availW / rawTotal));
  const colWidths = baseWidths.map((w) => Math.round(w * fitW));
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const fitFs = Math.min(1.3, fitW);
  const minCellH = Math.round((isPortrait ? sp(80) : 66) * Math.min(1.22, fitW));
  const startX = (DESIGN_WIDTH - totalW) / 2;
  // 表格垂直位置：竖屏在画布正中；横屏在「标题下沿」与「字幕带」之间居中，
  // 此前一律顶到 HEADER_OFFSET，两行表的内容会全挤在上半屏
  const tableH = (1 + rows.length) * minCellH;
  const startY = isPortrait
    ? (height - tableH) / 2
    : Math.max(HEADER_OFFSET, HEADER_OFFSET + (height - 240 - HEADER_OFFSET - tableH) / 2);
  const headerCellStyle = (i: number): React.CSSProperties => ({
    flex: `0 0 ${colWidths[i]}px`,
    minHeight: minCellH,
    background: i === 0 ? "rgba(255,255,255,0.18)" : "transparent",
    color: "#fff",
    fontSize: Math.round((isPortrait ? fs(i === 0 ? FS.caption : FS.body) : i === 0 ? FS.caption : FS.body) * fitFs),
    fontWeight: FW.heavy,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${isPortrait ? sp(8) : 8}px ${isPortrait ? sp(12) : 12}px`,
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: LH.tight,
    opacity: o,
  });
  const dataCellStyle = (ci: number, ry: number, zebra: boolean): React.CSSProperties => ({
    flex: `0 0 ${colWidths[ci]}px`,
    minHeight: minCellH,
    background: ci === 0 ? alpha(C.accent, 8) : zebra ? alpha(C.ink, 4) : "transparent",
    color: ci === 0 ? C.accent : C.ink,
    fontSize: Math.round((isPortrait ? fs(ci === 0 ? FS.caption : FS.body) : ci === 0 ? FS.caption : FS.body) * fitFs),
    fontWeight: ci === 0 ? FW.heavy : FW.regular,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: ci === 0 ? "center" : "flex-start",
    textAlign: ci === 0 ? "center" : "left",
    padding: `${isPortrait ? sp(10) : 10}px ${isPortrait ? sp(14) : 14}px`,
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: LH.body,
    opacity: ry,
    transform: `translateY(${(1 - ry) * 18}px)`,
  });
  return (
    <AbsoluteFill
      style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexDirection: "column" }}
    >
      {/* 标题统一走 PageHeading：table 页此前自己画了一个 48px 黑体标题，
          于是永远没有主题的胶囊/竖线/纯文字形态、没有装饰线、也没有手绘标注 */}
      <PageHeading text={title} />
      <Card pad={0} style={{ position: "absolute", top: startY, left: startX, width: totalW }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", background: ACCENT_GRAD }}>
          {headers.map((h, i) => (
            <div key={`h${i}`} style={headerCellStyle(i)}>
              {h || ""}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => {
          const rowStart = timing.frameAt(ri, 4, 8);
          const ry = interpolate(f, [rowStart, rowStart + 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const zebra = ri % 2 === 1;
          return (
            <div key={`r${ri}`} style={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
              {r.map((cell, ci) => (
                <div key={`c${ri}-${ci}`} style={dataCellStyle(ci, ry, zebra)}>
                  {cell}
                </div>
              ))}
            </div>
          );
        })}
      </Card>
    </AbsoluteFill>
  );
};
