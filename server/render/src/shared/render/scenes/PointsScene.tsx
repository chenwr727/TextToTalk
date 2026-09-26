import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, CONTENT_WIDTH, SPACE, RADIUS, BORDER, CARD_SHADOW, DOT_SHADOW, accentOf, FS, FW, GLASS, springIn } from "../theme";
import { Icon } from "../Icon";
import { pointText, pointIcon, pointAnchor } from "../point";
import { HandHighlight } from "../rough";
import { useResponsive, useCaptionReserve } from "../responsive";
import { useSceneTiming, resolveAnchor } from "../captionTiming";
import type { SceneProps } from "./types";

type Scale = {
  leadFs: number; subFs: number;
  leadPad: string; subPad: string;
  btnLead: number; btnSub: number;
  iconLead: number; iconSub: number;
  lineHeight: number;
  gap: number; rowMb: number; padTop: number;
};

const LEAD_ROLES: ReadonlySet<string> = new Set(["hook", "why"]);

const SCALES: Scale[] = [
  { leadFs: 64, subFs: 52, leadPad: "30px 40px", subPad: "26px 36px", btnLead: 76, btnSub: 64, iconLead: 40, iconSub: 34, lineHeight: 1.4, gap: 26, rowMb: SPACE.lg, padTop: 240 },
  { leadFs: 58, subFs: 48, leadPad: "28px 38px", subPad: "24px 34px", btnLead: 72, btnSub: 60, iconLead: 38, iconSub: 32, lineHeight: 1.4, gap: 24, rowMb: SPACE.lg, padTop: 225 },
  { leadFs: 52, subFs: 44, leadPad: "26px 34px", subPad: "22px 30px", btnLead: 66, btnSub: 56, iconLead: 36, iconSub: 30, lineHeight: 1.4, gap: 22, rowMb: SPACE.md, padTop: 210 },
  { leadFs: 46, subFs: 38, leadPad: "24px 32px", subPad: "20px 28px", btnLead: 60, btnSub: 50, iconLead: 32, iconSub: 28, lineHeight: 1.35, gap: 20, rowMb: SPACE.sm, padTop: 195 },
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

const PointCard: React.FC<CardProps> = ({ text, index, isLead, scale, isPortrait, highlight, enter, fs, sp, icon, pulse }) => {
  const a = accentOf(index);
  const len = [...text].length;
  const fsz = Math.round((isLead ? scale.leadFs : scale.subFs) * lenAdjOf(len));
  const pad = isLead ? scale.leadPad : scale.subPad;
  const btn = isLead ? scale.btnLead : scale.btnSub;
  const ic = isLead ? scale.iconLead : scale.iconSub;
  return (
    <div style={{
      position: "relative",
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
    }}>
      <div style={{
        position: "relative", display: "flex", alignItems: "center", padding: isPortrait ? pad.replace(/(\d+)px/g, (m, n) => `${sp(Number(n))}px`) : pad,
        background: pulse > 0.02 ? `linear-gradient(0deg, ${a}14, ${a}14), ${GLASS.card}` : GLASS.card,
        border: `${BORDER.card}px solid ${a}`,
        borderRadius: RADIUS.card,
        boxShadow: pulse > 0.02 ? `0 8px 18px ${a}30, ${CARD_SHADOW}` : CARD_SHADOW,
        maxWidth: "100%", boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (isLead ? 10 : 6) + pulse * 4, background: `linear-gradient(180deg, ${a}, ${a}66)`, opacity: 0.75 + pulse * 0.25 }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
        <div style={{
          marginRight: isPortrait ? sp(24) : 24, flexShrink: 0,
          width: isPortrait ? sp(btn) : btn, height: isPortrait ? sp(btn) : btn, borderRadius: "50%",
          background: `${a}1a`, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: DOT_SHADOW,
        }}>
          <Icon name={icon} size={isPortrait ? sp(ic) : ic} color={a} />
        </div>
        <div style={{ fontSize: fs(fsz), fontWeight: isLead ? FW.heavy : FW.regular, color: C.ink, lineHeight: scale.lineHeight }}>
          {highlight ? (
            <HandHighlight color={a} progress={enter}>{text}</HandHighlight>
          ) : (
            text
          )}
        </div>
      </div>
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
  const scale: Scale = SCALES[scaleIdx] ?? SCALES[3];

  const padTop = [260, 230, 200, 170][scaleIdx] ?? 170;

  const SINGLE_COL_W = isPortrait ? contentWidth : 1240;
  const availW = SINGLE_COL_W;
  const captionTexts = page.sentences && page.sentences.length
    ? page.sentences.map((s) => s.text)
    : page.captions ?? [];
  const captionReserve = useCaptionReserve(subtitles, captionTexts);
  const availH = (isPortrait ? contentHeight : 1080) - padTop - captionReserve;

  const boxW = SINGLE_COL_W;
  const iconBlock = scale.btnSub + (isPortrait ? sp(24) : 24);
  const parseX = (padStr: string) => Number(padStr.split(" ")[1]?.replace("px", "") ?? "28") * 2;
  const padX = parseX(scale.subPad);
  const colH = Math.max(200, boxW - iconBlock - padX);
  const rowGap = (isPortrait ? sp(scale.gap) : scale.gap) + (isPortrait ? sp(scale.rowMb) : scale.rowMb);
  const leadEnabled = points.length > 1 && LEAD_ROLES.has(page.role ?? "");
  const estH = texts.reduce((sum, t, i) => {
    const isLead = leadEnabled && i === 0;
    const fsz = (isLead ? scale.leadFs : scale.subFs) * lenAdjOf([...t].length);
    const perLine = Math.max(1, Math.floor(colH / (fsz * 1.15)));
    const lines = Math.ceil([...t].length / perLine);
    const padV = Number((isLead ? scale.leadPad : scale.subPad).split(" ")[0].replace("px", ""));
    return sum + lines * fsz * scale.lineHeight + padV * 2 + rowGap;
  }, 0);

  const twoCol = texts.length >= 4 && estH > availH * 0.92;

  if (twoCol) {
    const left = points.map((p, i) => ({ p, i })).filter(({ i }) => i % 2 === 0);
    const right = points.map((p, i) => ({ p, i })).filter(({ i }) => i % 2 === 1);
    const renderCol = (items: { p: typeof points[number]; i: number }[]) =>
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
        <div style={{
          width: isPortrait ? contentWidth : CONTENT_WIDTH, maxWidth: isPortrait ? "100%" : "84%", fontFamily: FONT,
          paddingTop: isPortrait ? sp(padTop) : padTop,
          paddingBottom: captionReserve,
          display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "center",
          gap: isPortrait ? sp(24) : 36,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap, flex: 1 }}>{renderCol(left)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap, flex: 1 }}>{renderCol(right)}</div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", overflow: "hidden" }}>
      <div style={{
        width: isPortrait ? contentWidth : SINGLE_COL_W, fontFamily: FONT,
        paddingTop: isPortrait ? sp(padTop) : padTop,
        paddingBottom: captionReserve,
        display: "flex", flexDirection: "column", gap: isPortrait ? sp(scale.gap) : scale.gap,
      }}>
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
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
