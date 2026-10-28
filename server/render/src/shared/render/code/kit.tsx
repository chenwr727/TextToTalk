import type { CSSProperties, ReactNode } from "react";
import { alpha, accentOf, C, CARD_SHADOW, FS, FONT, FONT_DISPLAY, FW, RADIUS, useTheme } from "../theme";
import { HeadingContent } from "../PageHeading";
import { Icon as InlineIcon, IconView } from "../Icon";

/**
 * 生成式版式的能力白名单。
 *
 * AI 写的组件只能通过这个对象拿到"设计语言"，拿不到 DOM、拿不到模块系统。
 * 这样放开"自己画一页"的同时，主题、暗色适配、字号体系仍然统一 ——
 * 否则生成页面会立刻退化成"AI 自己写死的十六进制配色"。
 */
const Text: React.FC<{
  children?: ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  display?: boolean;
  style?: CSSProperties;
}> = ({ children, size = FS.body, color = C.ink, weight = FW.regular, display = false, style }) => (
  <div
    style={{
      fontSize: size,
      color,
      fontWeight: weight,
      fontFamily: display ? FONT_DISPLAY : FONT,
      lineHeight: 1.35,
      ...style,
    }}
  >
    {children}
  </div>
);

const Card: React.FC<{ children?: ReactNode; accentIndex?: number; style?: CSSProperties }> = ({
  children,
  accentIndex = 0,
  style,
}) => {
  const t = useTheme();
  const accent = accentOf(accentIndex);
  return (
    <div
      style={{
        position: "relative",
        background: t.card.bg,
        border: `1px solid ${alpha(accent, 26)}`,
        borderRadius: RADIUS.card,
        boxShadow: CARD_SHADOW,
        padding: "28px 34px",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 24,
          bottom: 24,
          width: 5,
          borderRadius: 999,
          background: accent,
        }}
      />
      {children}
    </div>
  );
};

const Stat: React.FC<{
  value: string;
  label?: string;
  accentIndex?: number;
  /**
   * 数值字号，默认 `FS.hero`（96）。
   *
   * 加这个参数是因为竖屏：生成页面在 1080 宽下平均每个卡只有 300px 左右，
   * 96px 的"4.2 天"会折成两行、把整排卡片撑得高矮不齐。给生成代码一个下调的入口。
   */
  size?: number;
  style?: CSSProperties;
}> = ({ value, label, accentIndex = 0, size = FS.hero, style }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...style }}>
    <div
      style={{
        fontSize: size,
        fontWeight: FW.heavy,
        fontFamily: FONT_DISPLAY,
        color: accentOf(accentIndex),
        lineHeight: 1.05,
      }}
    >
      {value}
    </div>
    {label ? (
      <Text size={FS.label} color={C.sub}>
        {label}
      </Text>
    ) : null}
  </div>
);

const Pill: React.FC<{ text: string; icon?: string | null; accentIndex?: number; style?: CSSProperties }> = ({
  text,
  icon,
  accentIndex = 0,
  style,
}) => {
  const accent = accentOf(accentIndex);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 26px",
        borderRadius: RADIUS.pill,
        background: alpha(accent, 12),
        border: `1px solid ${alpha(accent, 30)}`,
        ...style,
      }}
    >
      {icon ? <InlineIcon name={icon} size={34} /> : null}
      <Text size={FS.label} color={C.ink} weight={FW.bold}>
        {text}
      </Text>
    </div>
  );
};

const Row: React.FC<{
  children?: ReactNode;
  gap?: number;
  align?: CSSProperties["alignItems"];
  style?: CSSProperties;
}> = ({ children, gap = 32, align = "center", style }) => (
  <div style={{ display: "flex", gap, alignItems: align, ...style }}>{children}</div>
);

const Col: React.FC<{ children?: ReactNode; gap?: number; style?: CSSProperties }> = ({
  children,
  gap = 32,
  style,
}) => <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>{children}</div>;

export const Kit = {
  /** 主题色令牌（全部是 CSS 变量，自动跟随主题与暗色） */
  C,
  FS,
  RADIUS,
  FONT,
  FONT_DISPLAY,
  /** 调色板第 i 个强调色，用于给多个块分配不同颜色 */
  accent: accentOf,
  alpha,
  /** 页面标题（与其它版式同一套标题语言，含手绘标注） */
  Heading: HeadingContent,
  Text,
  Card,
  Stat,
  Pill,
  Row,
  Col,
  /**
   * 内联图标（跟着父容器 flow 走）。
   * 注意别把 IconView 当内联图标用——那是页面右上角的绝对定位装饰，
   * 塞进卡片/胶囊里会直接飘到页面另一处（端到端跑真实生成时踩过这个坑）。
   */
  Icon: InlineIcon,
  /** 页面右上角的装饰性大图标（绝对定位，自带淡入） */
  CornerIcon: IconView,
};

export type PageKit = typeof Kit;
