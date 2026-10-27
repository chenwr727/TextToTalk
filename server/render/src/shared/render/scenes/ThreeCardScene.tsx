import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, C, FONT, FW, RADIUS, SPACE, CARD_TYPE, pickCardFont, accentOf, springIn } from "../theme";
import { Card } from "../Card";
import { IconTile } from "../IconTile";
import { ICON_KEYS } from "../Icon";
import { PageHeading } from "../PageHeading";
import { linesByPunct } from "../cjk";
import { pointText, pointIcon, pointAnchor } from "../point";
import { useResponsive } from "../responsive";
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
  const textAreaH = isPortrait ? sp(240) : CARD_H - padY * 2 - ICON_BOX - ICON_GAP;

  /** 横屏卡加宽到 520 后，全局阶梯顶格 34 偏小；本版式单独延到 40 */
  const FS_STEPS = isPortrait ? CARD_TYPE.fsCandidates : ([40, 36, 32, 28, 24] as const);
  const pickFs = (s: string) => {
    const chosen = pickCardFont(Array.from(s).length, textW, textAreaH, FS_STEPS);
    return { fs: chosen, lh: CARD_TYPE.lineHeight, align: "left" as const, justify: "flex-start" as const };
  };
  const longest = items.length
    ? items.map((it, i) => pointText(it, i)).reduce((a, b) => (Array.from(a).length >= Array.from(b).length ? a : b))
    : "…";
  const sc = pickFs(longest);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <PageHeading text={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? sp(CARD_GAP) : 48,
          marginTop: isPortrait ? sp(170) : 170,
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
                  height: isPortrait ? undefined : CARD_H,
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
                <div
                  style={{
                    position: "absolute",
                    top: isPortrait ? "100%" : "50%",
                    right: isPortrait ? "50%" : -(CARD_GAP / 2),
                    width: 40,
                    height: 40,
                    transform: isPortrait ? "translate(50%, -50%)" : "translate(50%, -50%)",
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
                    width={34}
                    height={22}
                    viewBox="0 0 34 22"
                    fill="none"
                    style={{ transform: isPortrait ? "rotate(90deg)" : "none" }}
                  >
                    <path d="M2 11 H24" stroke={a} strokeWidth={4} strokeLinecap="round" />
                    <path
                      d="M18 4 L28 11 L18 18"
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
    </AbsoluteFill>
  );
};
