import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FS, FW, LH, ACCENT_HEADER_GRAD, springIn } from "../theme";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming } from "../captionTiming";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
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

export const TableScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const headers = page.table!.headers;
  const rows = page.table!.rows;
  const f = useCurrentFrame();
  const { fps, height: canvasH } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionReserve = useCaptionReserve(
    subtitles,
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []),
  );
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
  // 竖屏整张表只有 265px 高（占画布 14%），像贴了张邮票：允许更大的放大系数
  /*
   * 字号上限跟着行高一起放宽（1.6 -> 1.85）。
   *
   * 行高变成 220px 后，34px 的字在里面显得像「浮在空格里」。
   * 字号只受列宽（fitW）和这个上限双重约束，列宽没变，
   * 所以这一档只是把“字太小”那一头补上；真溢出就会折行，而行高有余量。
   */
  const fitFs = Math.min(isPortrait ? 1.85 : 1.3, fitW);
  /*
   * 行高不只是“下限”，竖屏还要按剩余空间往上长。
   *
   * 原来死定 sp(120) * min(1.22, fitW) ≈ 124px：三行的表只有 4*124 = 496px，
   * 可用带却有 ~1480px —— 实测整张表只占 29%，上下各空一大片。
   * 竖屏没有“列多”的压力，行高就该去吃剩余高度（目标 62%），
   * 封顶 sp(260) 避免两三行的表被拉成一屏字段。
   */
  const nRows = 1 + rows.length;
  /* 用画布高：竖屏的 contentHeight 已扣过 safeY*2（实测带高比真实值少 160px，表格只能拉到 46%） */
  const bandH = Math.max(0, canvasH - contentTop - captionReserve);
  /*
   * 横屏也要让表格去吃正文带：原先横屏 minCellH 就是 baseCellH（66px 量级），
   * 四行表只有 265px 高，再被"在带里居中"的逻辑摆到 415..772——
   * 实测标题下空 209px、表格上下一对白边，1920×1080 里像贴了张小抄。
   * 现在横屏按带高 0.86 分行高（封顶 190，避免两三行表被拉成字段列表），并从 contentTop 起笔。
   */
  const baseCellH = Math.round((isPortrait ? sp(120) : 66) * Math.min(1.22, fitW));
  const minCellH = Math.round(
    /*
     * 竖屏目标填充率从 0.62 提到 0.86，单元格高度上限 sp(260)→sp(340)：
     * 实测改前表格正文 518..1406（带 1482px 只用了 60%），且上方空 342px。
     */
    Math.min(isPortrait ? sp(340) : 190, Math.max(baseCellH, (bandH * 0.86) / nRows)),
  );
  const startX = (DESIGN_WIDTH - totalW) / 2;
  // 表格垂直位置：竖屏在画布正中；横屏在「标题下沿」与「字幕带」之间居中
  const tableH = nRows * minCellH;
  /*
   * 居中的“可用带”必须扣掉字幕条：只按 contentTop..height 算会把表格整体往下推半个
   * 字幕高度（实测表格原先落在 490..850：上面空 240、下面只剩 75）。
   */
  /* 横竖屏都贴标题排（竖屏原来整页居中，标题下方空 342px） */
  const startY = contentTop + Math.max(0, (bandH - tableH) / 2);
  /**
   * 数值格子拆成「数字 + 单位」两段。
   *
   * 整格右对齐时单位也跟着右贴，于是「3 人 / 1 人 / 0.5 人」里只有字对得上、
   * 数字本身参差；单位长度不一时（元 / 万元）更乱。把单位放进定宽尾部小字号，
   * 数字就能在一列里对齐。顺手补千分位（12000 -> 12,000）。
   */
  const splitNumUnit = (raw: string): { num: string; unit: string } => {
    const s = String(raw ?? "").trim();
    const m = s.match(/^([-+]?[\d,.]+)\s*(.*)$/);
    if (!m) return { num: s, unit: "" };
    const digits = Number(m[1].replace(/,/g, ""));
    const num = Number.isFinite(digits)
      ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(digits)
      : m[1];
    return { num, unit: m[2] ?? "" };
  };
  /** 同一列的单位统一定宽（按最长单位算），数字才能对齐 */
  const unitWidthOf = (ci: number): number => {
    const units = rows.map((r) => splitNumUnit(String(r[ci] ?? "")).unit);
    return Math.max(0, ...units.map((u) => Array.from(u).length));
  };
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
  /**
   * 数值列：整列（除表头）都像数字时右对齐 + 等宽数字。
   * 表格里「1.5 天 / 40% / 12 分」左对齐会参差不齐，右对齐后小数点能对上，
   * 这是排版上最能一眼看出"做过"的细节之一。
   */
  const numericCol = (ci: number): boolean =>
    ci > 0 &&
    rows.length > 0 &&
    rows.every((r) => {
      const v = String(r[ci] ?? "").trim();
      return v !== "" && /^[-+]?[\d,.]+\s*[%‰]?$|^[-+]?[\d,.]+\s*[^\d\s]{1,2}$/.test(v);
    });
  const dataCellStyle = (ci: number, ry: number, zebra: boolean): React.CSSProperties => ({
    flex: `0 0 ${colWidths[ci]}px`,
    minHeight: minCellH,
    background: ci === 0 ? alpha(C.accent, 8) : zebra ? alpha(C.ink, 7) : "transparent",
    color: ci === 0 ? C.accent : C.ink,
    fontSize: Math.round((isPortrait ? fs(ci === 0 ? FS.caption : FS.body) : ci === 0 ? FS.caption : FS.body) * fitFs),
    fontWeight: ci === 0 ? FW.heavy : FW.regular,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: ci === 0 ? "center" : numericCol(ci) ? "flex-end" : "flex-start",
    textAlign: ci === 0 ? "center" : numericCol(ci) ? "right" : "left",
    fontVariantNumeric: numericCol(ci) ? "tabular-nums" : undefined,
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
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", background: ACCENT_HEADER_GRAD }}>
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
                  {numericCol(ci)
                    ? (() => {
                        const { num, unit } = splitNumUnit(String(cell ?? ""));
                        const uw = unitWidthOf(ci);
                        return (
                          <>
                            <span>{num}</span>
                            {unit ? (
                              <span
                                style={{
                                  // 定宽尾部单位：不参与数字的右对齐，但能把整列数字推成一条线
                                  display: "inline-block",
                                  minWidth: `${uw}ch`,
                                  marginLeft: isPortrait ? sp(8) : 8,
                                  fontSize: "0.72em",
                                  fontWeight: FW.regular,
                                  color: C.sub,
                                }}
                              >
                                {unit}
                              </span>
                            ) : null}
                          </>
                        );
                      })()
                    : cell}
                </div>
              ))}
            </div>
          );
        })}
      </Card>
    </AbsoluteFill>
  );
};
