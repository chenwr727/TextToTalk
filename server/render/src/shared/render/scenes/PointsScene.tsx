import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, CONTENT_WIDTH, SPACE, DOT_SHADOW, accentOf, FW, springIn, HEADER_OFFSET } from "../theme";
import { Icon } from "../Icon";
import { Card } from "../Card";
import { PageHeading } from "../PageHeading";
import { pointText, pointIcon, pointAnchor } from "../point";
import { HandHighlight } from "../rough";
import { useResponsive, useCaptionReserve, portraitFill } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

type Scale = {
  leadFs: number;
  subFs: number;
  leadPad: string;
  subPad: string;
  btnLead: number;
  btnSub: number;
  iconLead: number;
  iconSub: number;
  lineHeight: number;
  gap: number;
  rowMb: number;
  padTop: number;
};

const LEAD_ROLES: ReadonlySet<string> = new Set(["hook", "why"]);

const SCALES: Scale[] = [
  {
    leadFs: 64,
    subFs: 52,
    leadPad: "30px 40px",
    subPad: "26px 36px",
    btnLead: 76,
    btnSub: 64,
    iconLead: 40,
    iconSub: 34,
    lineHeight: 1.4,
    gap: 26,
    rowMb: SPACE.lg,
    padTop: 240,
  },
  {
    leadFs: 58,
    subFs: 48,
    leadPad: "28px 38px",
    subPad: "24px 34px",
    btnLead: 72,
    btnSub: 60,
    iconLead: 38,
    iconSub: 32,
    lineHeight: 1.4,
    gap: 24,
    rowMb: SPACE.lg,
    padTop: 225,
  },
  {
    leadFs: 52,
    subFs: 44,
    leadPad: "26px 34px",
    subPad: "22px 30px",
    btnLead: 66,
    btnSub: 56,
    iconLead: 36,
    iconSub: 30,
    lineHeight: 1.4,
    gap: 22,
    rowMb: SPACE.md,
    padTop: 210,
  },
  {
    leadFs: 46,
    subFs: 38,
    leadPad: "24px 32px",
    subPad: "20px 28px",
    btnLead: 60,
    btnSub: 50,
    iconLead: 32,
    iconSub: 28,
    lineHeight: 1.35,
    gap: 20,
    rowMb: SPACE.sm,
    padTop: 195,
  },
];

const lenAdjOf = (len: number) => (len <= 14 ? 1 : len <= 20 ? 0.94 : len <= 26 ? 0.88 : 0.82);

interface CardProps {
  text: string;
  index: number;
  isLead: boolean;
  scale: Scale;
  isPortrait: boolean;
  highlight: boolean;
  enter: number;
  fs: (n: number) => number;
  sp: (n: number) => number;
  icon: string;
  /** 单列统一定宽；不给则按内容宽度 */
  cardW?: number;
  pulse: number;
}

const FOCUS_IN = 10;
const FOCUS_OUT = 26;

const pulseAt = (frame: number, startFrame: number): number => {
  const t = frame - startFrame;
  if (t < 0) return 0;
  if (t < FOCUS_IN) return t / FOCUS_IN;
  const decay = (t - FOCUS_IN) / FOCUS_OUT;
  return decay >= 1 ? 0 : 1 - decay;
};

const PointCard: React.FC<CardProps> = ({
  text,
  index,
  isLead,
  scale,
  isPortrait,
  highlight,
  enter,
  fs,
  sp,
  icon,
  cardW,
  pulse,
}) => {
  const a = accentOf(index);
  const len = [...text].length;
  const fsz = Math.round((isLead ? scale.leadFs : scale.subFs) * lenAdjOf(len));
  const btn = isLead ? scale.btnLead : scale.btnSub;
  const ic = isLead ? scale.iconLead : scale.iconSub;
  return (
    <div
      style={{
        position: "relative",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
      }}
    >
      {/* 要点行：原先自己拼了玻璃底 + 左侧竖条 + 顶部高光，唯独漏了 Card 的内描边，
          同一页里卡片质感比 three_card 差一档。现在统一走 <Card leftBar focus>。
          padding 也从"字符串 + 正则反解析缩放"改成结构化数值，间距可追 */}
      <Card
        accent={a}
        leftBar
        focus={pulse > 0.02}
        pad={sp(isLead ? SPACE.lg : SPACE.md)}
        style={{
          display: "flex",
          // 必须写方向：只写 display:flex 时方向默认是 row，内部玻璃底会变成
          // "按内容宽度"的 flex item，给外层设多宽的 width 都不会传导下去
          flexDirection: "column",
          width: cardW,
          // 统一宽度后整块比内容带窄，左右留白居中，避免整页往左偏
          marginLeft: cardW ? "auto" : undefined,
          marginRight: cardW ? "auto" : undefined,
          maxWidth: "100%",
          transform: `translateY(0)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", maxWidth: "100%" }}>
          <div
            style={{
              marginRight: isPortrait ? sp(24) : 24,
              flexShrink: 0,
              width: isPortrait ? sp(btn) : btn,
              height: isPortrait ? sp(btn) : btn,
              borderRadius: "50%",
              background: `${alpha(a, 10)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: DOT_SHADOW,
            }}
          >
            <Icon name={icon} size={isPortrait ? sp(ic) : ic} color={a} />
          </div>
          <div
            style={{
              fontSize: fs(fsz),
              fontWeight: isLead ? FW.heavy : FW.regular,
              color: C.ink,
              lineHeight: scale.lineHeight,
              textWrap: "balance",
            }}
          >
            {highlight ? (
              <HandHighlight color={a} progress={enter}>
                {text}
              </HandHighlight>
            ) : (
              text
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export const PointsScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const points = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, fs, sp, contentWidth, contentHeight } = useResponsive();
  const timing = useSceneTiming();

  const texts = points.map((p, i) => pointText(p, i));
  const maxLen = texts.reduce((m, t) => Math.max(m, [...t].length), 0);
  const byCount = Math.min(points.length + (isPortrait ? 1 : 0), SCALES.length) - 1;
  const byLength = maxLen <= 14 ? 0 : maxLen <= 20 ? 1 : maxLen <= 30 ? 2 : 3;
  const scaleIdx = Math.min(SCALES.length - 1, Math.max(byCount, byLength));
  const baseScale: Scale = SCALES[scaleIdx] ?? SCALES[3];

  /*
   * 顶部留白以 PageHeading 底部为准。
   * 原来写死成 [360, 330, 300, 270][scaleIdx]：标题高度与条数、字数无关，
   * 这个梯子只是历史上调出来的“好看”值。
   */
  const padTop = HEADER_OFFSET + SPACE.md;

  // 横屏内容带此前固定 1240（画布 1920），两侧留白比正文还宽，画面显得空。
  // 但不能一味加宽：短句铺满 1680 会变成"一行只放一句"的大字报。
  // 所以按最长一条文案的长度分三档——短的保持紧凑，长的才放宽。
  const singleColW = isPortrait
    ? contentWidth
    : Math.round(Math.min(CONTENT_WIDTH * 0.95, [1240, 1460, 1600][maxLen <= 14 ? 0 : maxLen <= 22 ? 1 : 2]));

  const availW = singleColW;
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const availH = (isPortrait ? contentHeight : 1080) - padTop - captionReserve;

  const boxW = singleColW;
  const parseX = (padStr: string) => Number(padStr.split(" ")[1]?.replace("px", "") ?? "28") * 2;
  const leadEnabled = points.length > 1 && LEAD_ROLES.has(page.role ?? "");

  /** 按给定字号阶梯估算这页要点自然占多高；竖屏放大量要靠它反推 */
  const estHeightOf = (s: Scale) => {
    const iconBlockS = s.btnSub + (isPortrait ? sp(24) : 24);
    const colHS = Math.max(200, boxW - iconBlockS - parseX(s.subPad));
    const rowGapS = (isPortrait ? sp(s.gap) : s.gap) + (isPortrait ? sp(s.rowMb) : s.rowMb);
    return texts.reduce((sum, t, i) => {
      const isLead = leadEnabled && i === 0;
      const fsz = (isLead ? s.leadFs : s.subFs) * lenAdjOf([...t].length);
      const perLine = Math.max(1, Math.floor(colHS / (fsz * 1.15)));
      const lines = Math.ceil([...t].length / perLine);
      const padV = Number((isLead ? s.leadPad : s.subPad).split(" ")[0].replace("px", ""));
      return sum + lines * fsz * s.lineHeight + padV * 2 + rowGapS;
    }, 0);
  };

  /**
   * 竖屏稀疏页放大。
   *
   * 字号是按"每行放多少字"定的，但竖屏的竖向空间是横屏两倍：3 条要点的页实测只占
   * 可用内容带的 37%，上下各一大片空白。这里按估算高度反推放大量，只放大字号与
   * 行内间距（间距封顶 1.3，否则字大了留白更散），卡片结构不动。
   */
  const mkScale = (z: number): Scale =>
    z > 1.01
      ? {
          ...baseScale,
          leadFs: Math.round(baseScale.leadFs * z),
          subFs: Math.round(baseScale.subFs * z),
          btnLead: Math.round(baseScale.btnLead * z),
          btnSub: Math.round(baseScale.btnSub * z),
          iconLead: Math.round(baseScale.iconLead * z),
          iconSub: Math.round(baseScale.iconSub * z),
          gap: Math.round(baseScale.gap * Math.min(z, 1.3)),
          rowMb: Math.round(baseScale.rowMb * Math.min(z, 1.3)),
        }
      : baseScale;
  /*
   * 竖屏放大要同时满足两件事：尽量填满可用带，但不能装不下。
   *
   * 旧写法只靠 portraitFill 的 max 封顶，4 条长文案的页只能放到 ~1.04（实测卡片组占
   * 可用带 38%）；把上限提到 1.6 后 estH 又会超过 twoCol 阈值、整页被切成两列。
   * 这里改成：先用 portraitFill 给一个期望值，再逐步回退到
   * 「估算高度 ≤ 可用带 95%」的最大倍数。两列降级改成按基准字号判定是不是真的装不下，
   * 不再跟放大倍数耦合。
   */
  let zoom = isPortrait ? portraitFill(estHeightOf(baseScale), availH, { max: 1.6, target: 0.86 }) : 1;
  for (let guard = 0; guard < 12 && estHeightOf(mkScale(zoom)) > availH * 0.95; guard++) zoom -= 0.06;
  zoom = Math.max(1, Math.round(zoom * 100) / 100);
  const scale: Scale = mkScale(zoom);

  const iconBlock = scale.btnSub + (isPortrait ? sp(24) : 24);
  const padX = parseX(scale.subPad);
  const colH = Math.max(200, boxW - iconBlock - padX);
  const rowGap = (isPortrait ? sp(scale.gap) : scale.gap) + (isPortrait ? sp(scale.rowMb) : scale.rowMb);
  /**
   * 单列要点统一宽度。
   *
   * 不统一时每张卡按自己文字宽度收缩，一页里三条右边缘参差不齐（952/748/911），
   * 看着像随手摆的。取"最宽一条的估算宽度"作统一值：右边缘对齐，又不至于把
   * 短句撑成一大片空白。
   */
  const needW = texts.map((t, i) => {
    const isLead = leadEnabled && i === 0;
    const fsz = (isLead ? scale.leadFs : scale.subFs) * lenAdjOf([...t].length);
    return [...t].length * fsz * 1.04 + scale.btnSub + 24;
  });
  /*
   * 统一宽度还得有个下限。
   *
   * `min(singleColW, 最宽一条的估算宽 + 96)` 会让短句页退化：三张卡只有 1047px
   * （画布 54%），两侧各空 436px，文字右边还留 94px 死区。给内容带的 90% 兜底，
   * 卡宽就只在一个窄区间里浮动，整页看起来是"铺满的一条"，而不是居中的小票条。
   */
  const uniformW = Math.max(
    Math.min(singleColW, Math.ceil(Math.max(...needW) + 96)),
    Math.round(singleColW * 0.9),
  );

  const estH = estHeightOf(scale);
  /**
   * 竖屏剩余空间分摊到卡片间距。
   *
   * 纯靠放大字号填满竖向空间会让长句折行折出"孤字"（实测第一条把「人」挤到第二行），
   * 比空着更难看。所以字号只温和放大，剩下的竖向空间交给间距，且间距最多 +120%。
   */
  const portraitGap = (() => {
    if (!isPortrait || points.length < 2) return 0;
    const want = availH * 0.62 - estH;
    const extra = want / (points.length - 1);
    return Math.round(Math.min(sp(scale.gap) * 1.2, Math.max(0, extra)));
  })();

  const twoCol = texts.length >= 4 && estHeightOf(baseScale) > availH * 0.95;

  if (twoCol) {
    const left = points.map((p, i) => ({ p, i })).filter(({ i }) => i % 2 === 0);
    const right = points.map((p, i) => ({ p, i })).filter(({ i }) => i % 2 === 1);
    const renderCol = (items: { p: (typeof points)[number]; i: number }[]) =>
      items.map(({ p, i }) => {
        const at = resolveAnchor(timing, pointAnchor(p), i);
        return (
          <PointCard
            key={i}
            text={pointText(p, i)}
            index={i}
            isLead={false}
            scale={scale}
            isPortrait={isPortrait}
            highlight={leadEnabled && i === 0 && page.effects?.annotation === "highlight"}
            enter={springIn(f, fps, at, page.motion)}
            pulse={pulseAt(f, at)}
            fs={fs}
            sp={sp}
            icon={pointIcon(p, i)}
          />
        );
      });
    return (
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", overflow: "hidden" }}>
        <PageHeading text={page.title} />
        <div
          style={{
            width: isPortrait ? contentWidth : CONTENT_WIDTH,
            maxWidth: isPortrait ? "100%" : "84%",
            fontFamily: FONT,
            // 竖屏画布高达 1920，内容却只有三四行：沿用横屏"顶部留 300 多"的写法，
            // 结果内容全挤在上半屏、下半屏一片空白。竖屏改为在标题与字幕之间垂直居中
            paddingTop: isPortrait ? SPACE.lg : padTop,
            paddingBottom: captionReserve,
            flex: isPortrait ? 1 : undefined,
            display: "flex",
            flexDirection: "row",
            alignItems: isPortrait ? "center" : "flex-start",
            justifyContent: "center",
            gap: isPortrait ? sp(24) : 36,
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap, flex: 1 }}
          >
            {renderCol(left)}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap, flex: 1 }}
          >
            {renderCol(right)}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", overflow: "hidden" }}>
      <PageHeading text={page.title} />
      <div
        style={{
          width: isPortrait ? contentWidth : singleColW,
          fontFamily: FONT,
          paddingTop: isPortrait ? SPACE.lg : padTop,
          paddingBottom: captionReserve,
          // 两个方向都在"标题底 ~ 字幕条顶"之间居中：横屏原来是 flex-start 顶上去，
          // 结果卡片上面只隔 81px、下面空 206px
          flex: 1,
          justifyContent: "center",
          display: "flex",
          flexDirection: "column",
          gap: isPortrait ? sp(scale.gap) + portraitGap : scale.gap,
        }}
      >
        {points.map((p, i) => {
          const at = resolveAnchor(timing, pointAnchor(p), i);
          return (
            <PointCard
              key={i}
              text={pointText(p, i)}
              index={i}
              isLead={leadEnabled && i === 0}
              scale={scale}
              isPortrait={isPortrait}
              highlight={leadEnabled && i === 0 && page.effects?.annotation === "highlight"}
              enter={springIn(f, fps, at, page.motion)}
              pulse={pulseAt(f, at)}
              fs={fs}
              sp={sp}
              icon={pointIcon(p, i)}
              cardW={isPortrait ? undefined : uniformW}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
