import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FW, RADIUS, SPACE, CARD_TYPE, pickCardFont, accentOf, springIn } from "../theme";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { ICON_KEYS } from "../Icon";
import { PageHeading, useHeadingMetrics } from "../PageHeading";
import { linesByPunct } from "../cjk";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

/**
 * 横屏三卡：原先 440×340、间距 64，整组只占 1416（画布 1920 的 74%），
 * 两侧各留 250 的白，画面像"没铺满"。加宽到 520、间距收到 48，整组 1656，
 * 更接近 1680 的内容带；卡片变宽后 pickCardFont 会自然选到大一号的字。
 */
const CARD_W = 520;
const CARD_H = 356;
const CARD_GAP = CARD_TYPE.gapX;

export const ThreeCardScene: React.FC<SceneProps> = ({ page, subtitles }) => {
  const title = page.title;
  const items = page.points;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isPortrait, sp, contentWidth, contentHeight } = useResponsive();
  const { contentTop } = useHeadingMetrics();
  const captionTexts =
    page.sentences && page.sentences.length ? page.sentences.map((s) => s.text) : (page.captions ?? []);
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  /*
   * 横屏三卡按正文带高度撑高：卡高写死 356 时，标题下的空间全被浪费（体检报空洞 238px）。
   * 卡片内部本来就是 `justifyContent: center`，变高只会让图标+正文更居中，不会溢出。
   */
  const bandH = Math.max(0, contentHeight - contentTop - captionReserve);
  const cardH = isPortrait ? undefined : Math.round(Math.min(bandH * 0.74, CARD_H * 1.55));
  const timing = useSceneTiming();

  const padX = isPortrait ? sp(CARD_TYPE.padX) : CARD_TYPE.padX;
  const padY = isPortrait ? sp(CARD_TYPE.padY) : CARD_TYPE.padY;
  const textW = isPortrait ? contentWidth - padX * 2 : CARD_W - padX * 2;
  const ICON_BOX = isPortrait ? sp(CARD_TYPE.iconBox) : CARD_TYPE.iconBox;
  const ICON_GAP = 18;
  // 用撑高后的卡高算正文可用高度，否则卡变高了字号还按 356 选，白空间只是变多
  const textAreaH = isPortrait ? sp(240) : Math.max(CARD_H, cardH ?? CARD_H) - padY * 2 - ICON_BOX - ICON_GAP;

  /** 横屏卡加宽到 520 后，全局阶梯顶格 34 偏小；本版式单独延到 40 */
  const FS_STEPS = isPortrait ? CARD_TYPE.fsCandidates : ([40, 36, 32, 28, 24] as const);
  const pickFs = (s: string) => {
    const chosen = pickCardFont(Array.from(s).length, textW, textAreaH, FS_STEPS);
    return { fs: chosen, lh: CARD_TYPE.lineHeight, align: "left" as const, justify: "flex-start" as const };
  };
  const texts = [0, 1, 2].map((i) => (items[i] ? pointText(items[i], i) : "…"));
  const longest = texts.reduce((a, b) => (Array.from(a).length >= Array.from(b).length ? a : b), "…");
  const base = pickFs(longest);

  const portraitGap = sp(CARD_GAP);

  /** 给定字号，估算三张卡加上间距一共多高（竖屏放大要用它判断还放不放得下） */
  const measureCards = (fontSize: number, gap: number) => {
    const perCard = texts.reduce((sum, t) => {
      const perLine = Math.max(1, Math.floor((textW * 0.95) / fontSize));
      const lines = Math.max(1, Math.ceil(Array.from(t).length / perLine));
      return sum + padY * 2 + Math.max(ICON_BOX, lines * fontSize * CARD_TYPE.lineHeight);
    }, 0);
    return perCard + gap * (texts.length - 1);
  };

  /**
   * 竖屏放大。
   *
   * 三卡在竖屏里是三张单行卡横铺，实测内容只占竖向 23%，上下各空一大片。
   * 这里在"放得下"的前提下逐步加大字号（连带间距一起涨），直到占满目标高度，
   * 封顶 56px；卡宽已由 contentWidth 决定，字变大只会让长句折成两行，不会溢出。
   * 字号到顶后剩下的竖向空间分给卡间距——三卡本来就是一条流程，长一点的箭头站得住。
   */
  const { cardFs, gapPortrait } = (() => {
    if (!isPortrait) return { cardFs: base.fs, gapPortrait: 0 };
    const band = contentHeight - 240 - captionReserve;
    let font = base.fs;
    let gap = portraitGap;
    for (let guard = 0; guard < 16; guard++) {
      const nextFont = font + 2;
      const nextGap = Math.round(portraitGap * (1 + (nextFont - base.fs) / base.fs / 2));
      if (nextFont > 56) break;
      if (measureCards(nextFont, nextGap) > band * 0.9) break;
      font = nextFont;
      gap = nextGap;
    }
    const leftover = band * 0.82 - measureCards(font, gap);
    if (leftover > 0) gap = Math.round(Math.min(gap + leftover / 2, portraitGap * 2.4));
    return { cardFs: font, gapPortrait: gap };
  })();
  const sc = { ...base, fs: cardFs };

  return (
    <AbsoluteFill
      style={{
        // 横屏贴标题排：标题是绝对定位的，内容若相对整块画布居中，标题下方会白出 238px
        justifyContent: isPortrait ? "center" : "flex-start",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <PageHeading text={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? gapPortrait || portraitGap : 48,
          // 竖屏的 PageHeading 是绝对定位在顶部，这里再往下推 170 会把整组压到偏下，
          // 实测上方空 550px、下方只剩 330px；交给居中即可，marginTop 归零
          marginTop: isPortrait ? 0 : contentTop,
        }}
      >
        {[0, 1, 2].map((i) => {
          const o = springIn(
            f,
            fps,
            resolveAnchor(timing, items[i] ? pointAnchor(items[i]) : undefined, i),
            page.motion,
          );
          const t = items[i] ? pointText(items[i], i) : "…";
          const a = accentOf(i);
          return (
            <div
              key={i}
              style={{
                position: "relative",
                opacity: o,
                transform: `translateY(${interpolate(o, [0, 1], [60, 0])}px)`,
              }}
            >
              <Card
                accent={a}
                topBar
                pad={{ x: padX, y: padY }}
                style={{
                  width: isPortrait ? contentWidth : CARD_W,
                  // 竖屏改由内容撑高：固定套用横屏卡高会在高画布里留下大片空白，
                  // 而且一旦文案变长就溢出卡片（改字号缩放的实测就是这个现象）
                  height: isPortrait ? undefined : cardH,
                  minHeight: isPortrait ? sp(150) : undefined,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    flexDirection: isPortrait ? "row" : "column",
                    alignItems: isPortrait ? "center" : "flex-start",
                    justifyContent: isPortrait ? "flex-start" : "center",
                    gap: isPortrait ? SPACE.md : ICON_GAP,
                  }}
                >
                  <IconTile
                    name={items[i] ? pointIcon(items[i], i) : ICON_KEYS[(i + 6) % ICON_KEYS.length]}
                    accent={a}
                    size={isPortrait ? "md" : "lg"}
                  />
                  <div
                    style={{
                      fontSize: sc.fs,
                      fontWeight: FW.bold,
                      color: C.ink,
                      lineHeight: sc.lh,
                      fontFamily: FONT,
                      textAlign: sc.align,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {sc.align === "left" && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 4,
                          bottom: 4,
                          width: 5,
                          borderRadius: RADIUS.pill,
                          background: `linear-gradient(180deg, ${a}, ${alpha(a, 33)})`,
                        }}
                      />
                    )}
                    <div style={{ paddingLeft: 16, paddingRight: 8 }}>
                      {/*
                        按标点断行：浏览器 balance 均分宽度会把「决策」劈成「决 / 策被反复上推」。
                        perLine 用与 pickCardFont 同一口径（textW*0.95/字号）估算。
                      */}
                      {(linesByPunct(t, Math.floor((textW * 0.95) / sc.fs), 2) ?? [t]).map((line, li) => (
                        <div key={li}>{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
              {i < 2 && (
                <>
                  {/* 竖屏：卡与卡之间补一条细竖线，40px 的小圆章单独漂在中间会读不出"流向" */}
                  {isPortrait && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        width: 2,
                        height: Math.max(0, gapPortrait || portraitGap),
                        transform: "translateX(-50%)",
                        background: alpha(a, 30),
                        opacity: springIn(
                          f,
                          fps,
                          resolveAnchor(timing, items[i] ? pointAnchor(items[i]) : undefined, i) + 6,
                          page.motion,
                        ),
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      top: isPortrait ? "100%" : "50%",
                      right: isPortrait ? "50%" : -(CARD_GAP / 2),
                      width: 40,
                      height: 40,
                      /*
                       * 原来是一个 34×22 的裸 chevron：在 1920 画布上只有 1.8% 宽，
                       * 看着像误加上去的杂点。改成带底色的小圆章（直径 40 = 卡间距 48
                       * 刚好塞得下），有了底色和描边才读得出"流向"。
                       * 注意别额外横向平移：往右偏会让圆章盖进下一张卡，被后绘制的卡片压掉半边。
                       */
                      borderRadius: "50%",
                      background: alpha(a, 16),
                      border: `1.5px solid ${alpha(a, 34)}`,
                      /*
                       * 竖屏：箭头要落在卡间距的中间。
                       * 只写 translate(50%, -50%) 时圆章中心正好压在卡片下沿，
                       * 看起来像贴在卡下的一颗分隔点，而卡与卡之间反而空着。
                       */
                      transform: isPortrait
                        ? `translate(50%, calc(-50% + ${Math.round((gapPortrait || portraitGap) / 2)}px))`
                        : "translate(50%, -50%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: springIn(
                        f,
                        fps,
                        resolveAnchor(timing, items[i] ? pointAnchor(items[i]) : undefined, i) + 6,
                        page.motion,
                      ),
                    }}
                  >
                    <svg
                      width={22}
                      height={18}
                      viewBox="0 0 22 18"
                      fill="none"
                      style={{ transform: isPortrait ? "rotate(90deg)" : "none" }}
                    >
                      <path d="M1 9 H14" stroke={a} strokeWidth={3.5} strokeLinecap="round" />
                      <path
                        d="M10 3 L17 9 L10 15"
                        stroke={a}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
