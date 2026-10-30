import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  alpha,
  C,
  FONT,
  FS,
  FW,
  LH,
  RADIUS,
  BORDER,
  CARD_SHADOW,
  SOLID_SHADOW,
  SPACE,
  GLASS,
  CARD_TYPE,
  pickCardFont,
  accentOf,
  springIn,
} from "../theme";
import { Icon } from "../Icon";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

export const FlowScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps, height: canvasH } = useVideoConfig();
  const { isPortrait, sp, contentWidth } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const timing = useSceneTiming();
  const list = items;

  const n = Math.max(1, list.length);

  const CARD_PAD = isPortrait ? sp(CARD_TYPE.padX) : CARD_TYPE.padX;
  const CARD_PAD_Y = isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY;
  const ARROW_W = isPortrait ? sp(52) : 52;
  /*
   * 竖屏一列一张卡，卡与卡之间要留出一个箭头的位置。
   *
   * 原来直接用 gapY（约 24px），而箭头只在横排时才画（perRow=1 时
   * `(i+1)%perRow===0` 恒成立 → 箭头全部被关掉），三张卡变成三块无关联的色块，
   * "flow"这个语义完全丢了。现在行间距拉到能放下竖向箭头。
   */
  const ROW_GAP = isPortrait ? sp(64) : CARD_TYPE.gapY;
  const SIDE_PAD = isPortrait ? sp(20) : 90;
  const availW = isPortrait ? contentWidth : 1920 - SIDE_PAD * 2;
  const MIN_NODE_W = isPortrait ? sp(150) : 150;
  /*
   * 竖屏卡片的宽度上限。
   *
   * 原来写 sp(560)≈476：内容区 952px 宽，卡片只用了一半，左右各留 240px。实测帧里三张
   * 卡 x 只有 305..780（50% 宽），而卡片高度却是满档 470 —— 又窄又高的长方体，文字在
   * 中间一小团。竖屏一列一张卡，宽度就该用满，高度反而要收（见下面的 cardH）。
   */
  const MAX_NODE_W = isPortrait ? Math.max(MIN_NODE_W, availW) : 560;
  const MAX_PER_ROW = isPortrait ? 4 : 8;
  const MAX_ROWS = isPortrait ? 6 : 3;

  const rows = isPortrait ? n : Math.min(MAX_ROWS, Math.max(1, Math.ceil(n / 6)));
  const perRow = isPortrait ? 1 : Math.min(MAX_PER_ROW, Math.max(1, Math.ceil(n / rows)));
  const nodeW = Math.max(MIN_NODE_W, Math.min(MAX_NODE_W, (availW - (perRow - 1) * ARROW_W) / perRow));
  const ICON_SIDE = (isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox) + (isPortrait ? sp(16) : 16);
  const TEXT_W = Math.max(60, nodeW - CARD_PAD * 2 - ICON_SIDE);
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));

  /*
   * 横屏正文高度原先写死 760 - captionReserve（对着 1080 画布拍的脑袋），
   * 又因为外层容器 `justifyContent: center` 是按整块画布居中的，卡片实测落在 368..713：
   * 标题下沉 162px、带底再空 207px。现在改成用真实画布高减标题下沿与字幕带，
   * 容器也改成从 contentTop 起笔（见下面的 padding）。
   */
  const BODY_H = isPortrait ? 1500 : Math.max(0, canvasH - contentTop - captionReserve);
  const maxCardH = Math.floor(BODY_H / rows) - ROW_GAP;

  const ICON_BLOCK = isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox;
  const V_PAD = (isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY) * 2;
  const LINE_H = CARD_TYPE.lineHeight;

  const contentAvailH = Math.max(ICON_BLOCK, maxCardH - V_PAD);
  const nodeFs = pickCardFont(maxChars, TEXT_W, contentAvailH);
  const perLine = Math.max(1, Math.floor((TEXT_W * 0.95) / nodeFs));
  const lines = Math.ceil(maxChars / perLine);
  const textH = Math.ceil(lines * nodeFs * LINE_H);
  /*
   * 横屏卡片高度原来有个 150px 下限，于是 4 张卡被钉在 150 高，
   * 只占可用带（760px）的 26%：上面空 256px、下面空 304px，一页四片"贴着说明文字的色块"。
   * 改成按可用高度的 62% 兜底（≈300px），文字也跟着放大，卡片才有内容感。
   */
  /*
   * 竖屏一列卡：宽度已经用满（上面 MAX_NODE_W），高度就不能再吃满档。
   *
   * 原来 `cardH = maxCardH`：三张卡各 500px 高、文字只有两三行且垂直居中，看起来是三块
   * 巨大的色板中间浮着一小团字。改成「按内容定高，但至少占行带 62%、最多 1.15 倍内容高」
   * —— 三张 310 高的卡 + 间距总高约 990，占可画区 66%，也不再有大片色块。
   */
  const cardH = isPortrait
    ? Math.min(maxCardH, Math.max(Math.round(maxCardH * 0.5), Math.round((Math.max(ICON_BLOCK, textH) + V_PAD) * 1.15)))
    : Math.min(Math.max(Math.round(maxCardH * 0.86), Math.max(ICON_BLOCK, textH) + V_PAD), maxCardH);
  const iconSize = isPortrait ? sp(CARD_TYPE.iconSize) : CARD_TYPE.iconSize;
  const ICON_GAP = isPortrait ? sp(16) : 16;

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: isPortrait ? "center" : "flex-start",
          justifyContent: "center",
          // 横屏从正文带顶起笔（标题绝对定位、不占流，靠它才能贴住标题）
          padding: isPortrait ? `0 ${SIDE_PAD}px` : `${contentTop}px ${SIDE_PAD}px 0`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${perRow}, ${nodeW}px)`,
            columnGap: ARROW_W,
            rowGap: ROW_GAP,
            justifyItems: "stretch",
            justifyContent: "center",
          }}
        >
          {list.map((it, i) => {
            const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
            const a = accentOf(i);
            const showArrow = i < n - 1 && (isPortrait || (i + 1) % perRow !== 0);
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  opacity: o,
                  transform: `translateY(${interpolate(o, [0, 1], [24, 0])}px)`,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    background: `linear-gradient(165deg, ${a} 0%, ${alpha(a, 85)} 60%, ${alpha(a, 75)} 100%)`,
                    color: "#fff",
                    borderRadius: RADIUS.box,
                    padding: `${CARD_PAD_Y}px ${CARD_PAD}px`,
                    fontSize: nodeFs,
                    fontWeight: FW.bold,
                    width: nodeW,
                    height: cardH,
                    fontFamily: FONT,
                    lineHeight: CARD_TYPE.lineHeight,
                    boxShadow: SOLID_SHADOW,
                    display: "flex",
                    flexDirection: "row",
                    /* 竖屏卡片又宽又矮，图标和文字共一条中线才不显得悬空；横屏仍顶部对齐（多行文字要从上往下读） */
                    alignItems: isPortrait ? "center" : "flex-start",
                    justifyContent: "flex-start",
                    gap: ICON_GAP,
                    overflow: "hidden",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "45%",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
                      pointerEvents: "none",
                    }}
                  />
                  <span
                    style={{
                      width: isPortrait ? sp(52) : 52,
                      height: isPortrait ? sp(52) : 52,
                      borderRadius: RADIUS.chip,
                      background: "rgba(255,255,255,0.24)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={pointIcon(it, i)} size={iconSize} color="#fff" />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      wordBreak: "break-word",
                      position: "relative",
                      alignSelf: "center",
                      paddingRight: isPortrait ? sp(4) : 4,
                    }}
                  >
                    {pointText(it, i)}
                  </span>
                </div>
                {showArrow && (
                  <div
                    style={{
                      position: "absolute",
                      ...(isPortrait
                        ? { left: 0, right: 0, top: "100%", height: ROW_GAP }
                        : { left: "100%", top: 0, bottom: 0, width: ARROW_W }),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width={isPortrait ? sp(26) : Math.round(ARROW_W * 0.62)}
                      height={isPortrait ? sp(26) : 28}
                      viewBox="0 0 40 24"
                      fill="none"
                      style={isPortrait ? { transform: "rotate(90deg)" } : undefined}
                    >
                      <path d="M2 12 H30" stroke={a} strokeWidth={4} strokeLinecap="round" />
                      <path
                        d="M24 4 L34 12 L24 20"
                        stroke={a}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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

export const LoopScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, width, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();
  const list = items;

  const titleChars = Array.from(title).length;
  const titleLines = titleChars > 14 ? 2 : 1;
  const HEADER_BOTTOM = 90 + (titleLines === 2 ? 170 : 110);
  /*
   * 环形图的"底"必须让开字幕条。
   *
   * 原先写死 `1080 - 80`＝1000：四个节点落在椭圆上下两端，最下面那个正好被
   * 字幕条盖住（实测节点框 860..976，字幕条 925..1010），文字读不出来。
   * 这里跟其他版式一样按字幕实测高度预留。
   */
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const BOTTOM_SAFE = (isPortrait ? contentHeight : 1080) - captionReserve - (isPortrait ? sp(24) : 24);

  /*
   * 圆心必须是画布中心。
   *
   * 原来竖屏写 contentWidth / 2＝476，但节点用的是 AbsoluteFill 的绝对 left
   * （画布坐标，中心是 540）——整个环被整体左移 64px。实测帧：椭圆 x 范围
   * 185..790，中心 487 而非 540。
   */
  const CX = isPortrait ? width / 2 : 960;
  const CY = (HEADER_BOTTOM + BOTTOM_SAFE) / 2;

  const N = Math.max(1, list.length);

  const BASE_NODE_W = isPortrait ? sp(345) : 345;
  const nodeW = Math.max(isPortrait ? sp(210) : 210, BASE_NODE_W - Math.max(0, N - 4) * (isPortrait ? sp(20) : 20));
  const TEXT_W = Math.max(80, nodeW - (isPortrait ? sp(80) : 80));
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const FS_CANDIDATES = [32, 28, 24, 20];
  const MAX_LINES = 3;
  const nodeFs =
    FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / fsz))) <= MAX_LINES) ?? 20;
  const lines = Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / nodeFs)));
  const nodeH = Math.min(
    isPortrait ? sp(260) : 260,
    Math.max(isPortrait ? sp(116) : 116, Math.ceil(lines * nodeFs * 1.4) + (isPortrait ? sp(32) : 32)),
  );

  const RY = (BOTTOM_SAFE - HEADER_BOTTOM) / 2 - nodeH / 2 - (isPortrait ? sp(24) : 24);
  const RX = isPortrait
    ? Math.max(nodeW / 2 + (isPortrait ? sp(105) : 105), contentWidth / 2 - nodeW / 2 - (isPortrait ? sp(30) : 30))
    : Math.min(900 - nodeW / 2 - 30, Math.max(RY + 120, nodeW / 2 + 105));

  /*
   * 竖屏环：横半径用可用宽度，竖半径最多拉到 1.3 倍。
   *
   * 原来是 RX 305 / RY 600（1:2）的扁椭圆：三个节点被甩到「一个最上、两个中下」，
   * 中间空出 650px 的空白蛋形，底部还有一整段没用上的虚线弧——读起来像一个撑满
   * 整页的鬼影。纯正圆（R=330）虽然形状干净，但环只剩 660 高，纵向占 43% 又太瘪。
   * 折中：横半径 = 可用宽度半径，竖半径 = min(可用高度半径, 1.3 × 横半径)。
   * 节点随之分布在 330×429 的椭圆上，环高约 860（占可画区 57%），既是「环」又不像蛋。
   */
  const R = isPortrait ? Math.min(RX, RY) : 0;
  const RYc = isPortrait ? Math.min(RY, R * 1.3) : RY;

  return (
    <AbsoluteFill>
      <PageHeading text={title} />
      <svg
        width={(isPortrait ? R : RX) * 2}
        height={(isPortrait ? RYc : RY) * 2}
        style={{
          position: "absolute",
          left: CX - (isPortrait ? R : RX),
          top: CY - (isPortrait ? RYc : RY),
          opacity: 0.5,
        }}
      >
        <ellipse
          cx={isPortrait ? R : RX}
          cy={isPortrait ? RYc : RY}
          rx={(isPortrait ? R : RX) - 6}
          ry={(isPortrait ? RYc : RY) - 6}
          fill="none"
          stroke={C.accent}
          strokeOpacity={0.7}
          strokeWidth={4}
          strokeDasharray="14 12"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: CX - (isPortrait ? sp(90) : 90),
          top: CY - (isPortrait ? sp(90) : 90),
          width: isPortrait ? sp(180) : 180,
          height: isPortrait ? sp(180) : 180,
          borderRadius: "50%",
          /*
           * 原来是三层叠在一起：180px 主色实心圆 + 64px 白色玻璃圆 + 60px 主色小圆，
           * 最里面才是 FS.label（≈22px）的「循环」—— 圈大、字小、层数多，远看像个毛球。
           * 收成一层：主色渐变圆 + 44px 白字。
           */
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: CARD_SHADOW,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: isPortrait ? fs(44) : 44,
            fontWeight: FW.heavy,
            fontFamily: FONT,
            letterSpacing: 2,
          }}
        >
          循环
        </span>
      </div>
      {list.map((it, i) => {
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
        const x = CX + Math.cos(a) * (isPortrait ? R : RX);
        const y = CY + Math.sin(a) * (isPortrait ? RYc : RY);
        const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
        const ac = accentOf(i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - nodeW / 2,
              top: y,
              width: nodeW,
              height: nodeH,
              transform: "translateY(-50%)",
              opacity: o,
            }}
          >
            <div
              style={{
                position: "relative",
                width: nodeW,
                height: "100%",
                background: GLASS.card,
                border: `${BORDER.card}px solid ${ac}`,
                borderRadius: RADIUS.box,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isPortrait ? sp(10) : 10,
                padding: `${isPortrait ? sp(12) : 12}px ${isPortrait ? sp(16) : 16}px`,
                fontFamily: FONT,
                boxShadow: CARD_SHADOW,
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  fontSize: nodeFs,
                  fontWeight: FW.bold,
                  color: C.ink,
                  textAlign: "center",
                  lineHeight: LH.tight,
                  flex: 1,
                  wordBreak: "break-word",
                  textWrap: "balance",
                }}
              >
                {pointText(it, i)}
              </span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PyramidScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const f = useCurrentFrame();
  const { fps, height: canvasH } = useVideoConfig();
  const { isPortrait, sp, contentWidth, contentHeight } = useResponsive();
  const { contentTop } = useHeadingMetrics();
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
  const rawVals = chartVals.length >= 2 ? chartVals : tiers.map((t) => extractVal(t));
  const vals = rawVals.map((v, i) => (v !== null && Number.isFinite(v) && v > 0 ? v : Math.max(1, 100 - i * 20)));
  const maxVal = Math.max(...vals);

  const titleChars = Array.from(title).length;
  const titleLines = titleChars > 14 ? 2 : 1;
  const HEADER_BOTTOM = 90 + (titleLines === 2 ? 170 : 110);

  // 底层不放满画布：留 210px 边距，金字塔两侧有呼吸，也不至于像一根通栏横条
  const MAX_W = isPortrait ? contentWidth : 1920 - 210 * 2;
  const MIN_W = isPortrait ? sp(420) : 420;
  /**
   * 层级宽度 = 数值占最大值的比例，但要**软化**，否则画出来不像金字塔。
   *
   * 线性比例在真实数据下会被 MIN_W 夹死：样本 [3,12,85] 得到 420 / 420 / 1680，
   * 前两层变成两根一模一样的短条、底层是通栏横条——观众看到的不是"金字塔"，
   * 而是"两根小条 + 一根大条"。用 0.32 次幂压缩差距（→ 515 / 801 / 1500），
   * 既保留"越往下人越多"的语义，又让层与层的宽度差看得见。
   */
  const WIDTH_EXP = 0.32;
  const widths = vals.map((v) => {
    const ratio = Math.pow(v / maxVal, WIDTH_EXP);
    return Math.max(MIN_W, Math.round(MAX_W * ratio));
  });

  /**
   * 每一层的底色由"数值占最大值的比例"决定：越往下（数越大）越深。
   *
   * 文字颜色必须跟着底色走，不能跟着层号走——金字塔顶层数值最小、底色最浅，
   * 之前按"i===0 就白字"上色，结果顶层是白字配近白底，整行标题看不见。
   */
  const fillRatio = vals.map((v) => (v - Math.min(...vals)) / Math.max(1, maxVal - Math.min(...vals)));
  const cols = fillRatio.map((r) => {
    const from = [59, 111, 245],
      to = [212, 225, 255];
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
  /*
   * 横屏每层高度：原先取 min(内容需要的高度, 平均分到的高度)，
   * 于是三层只有约 450px、整组在画布里居中（实测 380..700，标题下沉 174px、带底又空 220px）。
   * 金字塔本来就是"一层占一段"的版式，直接把正文带按层数均分；竖屏保持原口径。
   */
  /*
   * 底部要给字幕条让位。
   * 只减 90px 时，三层金字塔量出正文 280..990——最底一层直接压在字幕条下面（看图确认）。
   */
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const availH = isPortrait
    ? contentHeight - HEADER_BOTTOM - Math.max(captionReserve, 90) - (N - 1) * SPACE.md
    : canvasH - contentTop - Math.max(captionReserve, 90) - (N - 1) * SPACE.md;
  const perTierH = Math.floor(availH / N);
  const tierMinH = isPortrait ? perTierH : Math.max(naturalH, Math.min(perTierH, 300));

  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isPortrait ? "center" : "flex-start",
          // 横屏从正文带顶起笔，别在整块画布上居中（标题是绝对定位，不占流）
          padding: isPortrait ? `${sp(30)}px 0` : `${contentTop + 30}px 0 0`,
        }}
      >
        {tiers.map((t, i) => {
          const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(t), i, 30), page.motion);
          /** 底色够深才用白字：阈值 0.45 对应中等偏深的那一档 */
          const onDark = (fillRatio[i] ?? 0) > 0.45;
          const label = typeof t === "string" ? t : pointText(t, i);
          const icon = typeof t === "string" ? "layers" : pointIcon(t, i);
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `scale(${interpolate(o, [0, 1], [0.9, 1], { output: "perceptual-scale" })})`,
                width: widths[i],
                minWidth: MIN_W,
                minHeight: tierMinH,
                padding: `${isPortrait ? sp(14) : 14}px ${isPortrait ? sp(32) : 32}px`,
                /*
                 * 层间距 24 -> 8：24px 的缝让三层读成"三根独立的条"，
                 * 缩小后层与层连成一片，金字塔的收窄关系才立得起来。
                 */
                marginBottom: i === N - 1 ? 0 : Math.min(10, Math.max(6, 10 - (N - 4) * 2)),
                background: cols[i],
                color: onDark ? "#fff" : "#1a2b4a",
                borderRadius: RADIUS.box,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isPortrait ? sp(16) : 16,
                fontSize: nodeFs,
                fontWeight: FW.heavy,
                fontFamily: FONT,
                lineHeight: 1.4,
                boxShadow: CARD_SHADOW,
              }}
            >
              <Icon name={icon} size={Math.max(24, Math.round(nodeFs * 0.9))} color={onDark ? "#fff" : "#3b6ff5"} />
              <span style={{ textAlign: "center" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const TimelineScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const list = items;

  const SIDE_SAFE = 60;
  const nodeSlot = (1920 - SIDE_SAFE * 2) / Math.max(1, list.length);
  /*
   * 标签宽度上限从写死的 400 改为“用满自己那一格”。
   * 3 个节点时每格 600px，而标签只给 400：「第 2 月：砍掉两道重复审批」被挤成
   * 两行且末字「批」孤零零掉到第二行。
   */
  const NODE_W = isPortrait ? contentWidth : Math.max(260, Math.round(nodeSlot - 32));
  const TEXT_W = NODE_W - (isPortrait ? sp(36) : 40);
  const FIRST_CX = NODE_W / 2 + SIDE_SAFE;
  const LAST_CX = 1920 - NODE_W / 2 - SIDE_SAFE;
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const TIMELINE_MAX_LINES = 3;
  const nodeFs = pickCardFont(maxChars, TEXT_W, TIMELINE_MAX_LINES * CARD_TYPE.fsCandidates[0] * CARD_TYPE.lineHeight);

  const lines = Math.ceil(maxChars / Math.max(1, Math.floor((TEXT_W * 0.95) / nodeFs)));
  const textH = lines * nodeFs * CARD_TYPE.lineHeight;
  /*
   * 竖屏时间轴的上边界要给标题让位、下边界要给字幕条让位。
   *
   * 原先写死 top=sp(40)、bottom=200：竖线从 y≈34 起笔，直接穿过顶部标题胶囊，
   * 一路拉到 y≈1720 钻进字幕条，中途三个节点被拉得七零八落。
   */
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  /*
   * 竖排时轴线的上下边界。
   *
   * 横屏也走竖排（见 vertical 的注释），所以这里要分两套：
   * 竖屏沿用原来的 sp(260)（不能动，竖屏已经对了），横屏用标题下沿算出的正文带顶。
   */
  const { contentTop } = useHeadingMetrics();
  const V_TOP = isPortrait ? sp(260) : contentTop;
  const V_BOTTOM = captionReserve + (isPortrait ? sp(40) : 40);
  const V_NODE_W = isPortrait ? contentWidth / 2 - sp(70) : 620;
  const V_DOT = isPortrait ? sp(60) : 96;
  const V_ICON = isPortrait ? sp(32) : 52;
  const V_AXIS_W = isPortrait ? 8 : 10;
  const V_GAP = isPortrait ? sp(16) : 24;
  /*
   * 横屏也走竖排时机：少数量（≤4）时。
   *
   * 原因：横屏的水平时间轴是一条 8px 细线 + 80px 圆，只占正文带中间 ~230px，
   * 实测空洞 228px（从 y=209 起）、fill 62%，在 1920×1080 里看着就像一根线漂在屏幕中间。
   * 改成竖排后，轴线从正文带顶拉到字幕条上，每个节点占满一段。
   * 节点多了（≥5）竖排会挤成一植，那时仍用原来的水平轴。
   */
  const vertical = isPortrait || list.length <= 4;
  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, position: "relative" }}>
        {vertical ? null : (
          /* 轴线两端与首尾节点的圆心严格对齐。 */
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: FIRST_CX,
              right: 1920 - LAST_CX,
              height: 8,
              transform: "translateY(-50%)",
              background: `linear-gradient(90deg, ${C.accent}, ${C.accentSoft})`,
              borderRadius: 4,
            }}
          />
        )}
        {vertical ? (
          <div style={{ position: "absolute", top: V_TOP, bottom: V_BOTTOM, left: 0, right: 0 }}>
            {/*
             * 轴线和节点放在同一个容器里、用百分比定位。
             * 先前轴线在外层、节点在内层，两层各自用 px 算坐标，
             * 结果轴线比节点少了一整段、末尾节点落在轴线外面。
             */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: `${50 / Math.max(1, list.length)}%`,
                height: `${((list.length - 1) * 100) / Math.max(1, list.length)}%`,
                width: V_AXIS_W,
                transform: "translateX(-50%)",
                background: C.accent,
                borderRadius: 4,
              }}
            />
            {list.map((it, i) => {
              const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
              const a = accentOf(i);
              const left = i % 2 === 0;
              // 百分比坐标：直接用容器实高算，不再依赖对 contentHeight 的估算
              const yPct = ((i + 0.5) * 100) / Math.max(1, list.length);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: `${yPct}%`,
                    /*
                     * 轴在画布中线：左侧节点贴到中线左侧、图标朝右挨着轴，
                     * 右侧节点贴到中线右侧、图标朝左挨着轴。
                     * 原先左侧节点用 `left: 0` + 行方向，图标被顶到画布最左边（半个圆被切掉），
                     * 而节点尾巴离轴还空着 120px。
                     */
                    /*
                     * 圆心要落在轴线上：原来用 `padding: V_PAD` 把整行往外让，
                     * 圆心就偏出轴线 V_PAD + V_DOT/2（横屏 28+48=76px）；
                     * 实测横屏时圆心在 x≈1025、轴线在 960，看着像串不上的一串珠子。
                     * 改成负半个直径的 margin：圆心恰好压在轴上，文字仍然贴着圆的外侧。
                     */
                    ...(left ? { right: "50%", marginRight: -V_DOT / 2 } : { left: "50%", marginLeft: -V_DOT / 2 }),
                    width: V_NODE_W,
                    transform: "translateY(-50%)",
                    display: "flex",
                    flexDirection: left ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: V_GAP,
                    opacity: o,
                  }}
                >
                  <div
                    style={{
                      width: V_DOT,
                      height: V_DOT,
                      borderRadius: "50%",
                      background: a,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: CARD_SHADOW,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={pointIcon(it, i)} size={V_ICON} color="#fff" />
                  </div>
                  <div
                    style={{
                      fontSize: nodeFs,
                      fontWeight: FW.bold,
                      color: C.ink,
                      textAlign: left ? "right" : "left",
                      fontFamily: FONT,
                      lineHeight: CARD_TYPE.lineHeight,
                      textWrap: "balance",
                      flex: 1,
                    }}
                  >
                    {pointText(it, i)}
                  </div>
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
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: cx,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: NODE_W,
                    opacity: o,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        height: textH,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        marginBottom: 22,
                        visibility: below ? "hidden" : "visible",
                      }}
                    >
                      <div
                        style={{
                          fontSize: nodeFs,
                          fontWeight: FW.bold,
                          color: C.ink,
                          textAlign: "center",
                          fontFamily: FONT,
                          lineHeight: CARD_TYPE.lineHeight,
                          textWrap: "balance",
                        }}
                      >
                        {!below ? pointText(it, i) : ""}
                      </div>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        // 时间轴只有一条轴 + 几个圆，圆太小整屏看起来是一根细线
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: a,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: CARD_SHADOW,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={pointIcon(it, i)} size={44} color="#fff" />
                    </div>
                    <div
                      style={{
                        height: textH,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        marginTop: 22,
                        visibility: below ? "visible" : "hidden",
                      }}
                    >
                      <div
                        style={{
                          fontSize: nodeFs,
                          fontWeight: FW.bold,
                          color: C.ink,
                          textAlign: "center",
                          fontFamily: FONT,
                          lineHeight: CARD_TYPE.lineHeight,
                          textWrap: "balance",
                        }}
                      >
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
  const { isPortrait, sp, contentWidth } = useResponsive();
  const timing = useSceneTiming();
  const list = items.slice(0, 4);
  /*
   * 四格的颜色；标签统一放在每格顶部的整宽标题条上。
   *
   * 原先四个标签各钉在自己格子的"外角"（左上格的左上、右下格的右下），
   * 于是四格里都是"一个角上有块小标签、其余大片空白"，四个格子还各锚在不同的角，
   * 看不出这是同一个 2×2 矩阵。改为统一顶部整宽，格子读起来是一张有标题的象限。
   */
  const cells = [{ a: C.accent }, { a: "#34c79f" }, { a: "#f2b03f" }, { a: "#e868a4" }];

  const TEXT_W = (isPortrait ? sp(550) : 550) - (isPortrait ? sp(26) : 26) * 2 - (isPortrait ? sp(24) : 24) * 2;
  const maxChars = Math.max(1, ...list.map((it, i) => Array.from(pointText(it, i)).length));
  const FS_CANDIDATES = [FS.body, 32, 28, 25, 22];
  const nodeFs = FS_CANDIDATES.find((fsz) => Math.ceil(maxChars / Math.max(1, Math.floor(TEXT_W / fsz))) <= 2) ?? 22;

  const GRID_H = isPortrait ? 1000 : 520;
  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <PageHeading text={title} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: isPortrait ? contentWidth : 1180, height: GRID_H }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 4,
              background: `${C.accentMid}`,
              borderRadius: 2,
              transform: "translateY(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 4,
              background: `${C.accentMid}`,
              borderRadius: 2,
              transform: "translateX(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: isPortrait ? sp(SPACE.md) : SPACE.md,
              border: `${BORDER.accent}px solid ${C.accent}`,
              borderRadius: RADIUS.card,
              padding: isPortrait ? sp(SPACE.md) : SPACE.md,
            }}
          >
            {list.map((it, i) => {
              const o = springIn(f, fps, resolveAnchor(timing, pointAnchor(it), i), page.motion);
              return (
                <div
                  key={i}
                  style={{
                    opacity: o,
                    height: "100%",
                    background: GLASS.card,
                    borderRadius: RADIUS.box,
                    border: `${BORDER.card}px solid ${cells[i].a}`,
                    display: "flex",
                    /*
                     * 内容居中。
                     *
                     * 原来 align/justify 都是 flex-start，而格子里唯一的子元素是那块标签，
                     * 于是横屏每格 480×224、竖屏每格 460×464，标签下面分别空出 63% / 78%
                     * 的纯白——四格看起来像"四块贴了标签的白板"，象限关系完全读不出来。
                     * 标签居中后空白均分到上下两侧，格子才像一个完整的象限单元。
                     */
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isPortrait ? sp(28) : 28,
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: isPortrait ? sp(14) : 14,
                      background: cells[i].a,
                      color: "#fff",
                      borderRadius: RADIUS.chip,
                      padding: `${isPortrait ? sp(20) : 20}px ${isPortrait ? sp(26) : 26}px`,
                      fontSize: nodeFs,
                      fontWeight: FW.bold,
                      fontFamily: FONT,
                      textAlign: "center",
                      lineHeight: 1.4,
                      boxShadow: SOLID_SHADOW,
                      // 不再拉满整宽：标签自己多宽就多宽，居中后四周留白均匀
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
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
