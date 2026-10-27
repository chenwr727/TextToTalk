import { alpha, C, CARD_SHADOW, RADIUS, BORDER, GLASS, ICON_TILE, iconInTile, tileShadow, focusShadow } from "./theme";
import { Icon } from "./Icon";

/**
 * 全站唯一的卡片容器。
 *
 * 改造前"卡片"有 7 套实现：ComparisonScene 整卡 1:1 重写、PointsScene 只做了半套
 * （丢了内描边）、Steps/Stats 只有裸玻璃底、QaScene 用渐变顶替玻璃、TableScene 用 box 圆角、
 * 生成式版式的 Kit.Card 又是第四套。结果同一个片子里卡片材质、内边距、圆角各不相同。
 *
 * 现在统一走这里，差异只通过 props 表达：
 *   icon       左上角图标方块（ICON_TILE 尺寸 + tileShadow）
 *   topBar     顶部彩虹条（强调卡）
 *   leftBar    左侧竖条（要点行，替代手写的 6/10px 竖条）
 *   pad        内边距，默认 SPACE.md；传 0 表示由调用方自己排
 *   focus      焦点态：主色描边加粗 + 主色光晕（替代各场景手写的 focus 阴影）
 */
export const Card: React.FC<{
  icon?: string;
  accent?: string;
  topBar?: boolean;
  leftBar?: boolean;
  focus?: boolean;
  /** 内边距：数字表示四边同值，{x,y} 表示横/纵不同（卡片里正文的内边距常常横纵不等） */
  pad?: number | { x?: number; y?: number };
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ icon, accent = C.accent, topBar = false, leftBar = false, focus = false, pad = 24, children, style }) => {
  const padStyle: React.CSSProperties =
    typeof pad === "number"
      ? pad
        ? { padding: pad }
        : {}
      : pad.x || pad.y
        ? { padding: `${pad.y ?? 0}px ${pad.x ?? 0}px` }
        : {};
  return (
    <div style={{ position: "relative", ...style }}>
      <div
        style={{
          position: "relative",
          height: "100%",
          boxSizing: "border-box",
          background: GLASS.card,
          border: `${focus ? BORDER.accent : BORDER.card}px solid ${focus ? accent : alpha(accent, 62)}`,
          borderRadius: RADIUS.card,
          boxShadow: focus ? focusShadow(accent) : CARD_SHADOW,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          ...padStyle,
        }}
      >
        {/* 顶部高光：让玻璃底有"受光面"，纯 CSS 渐变，不参与布局 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "46%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* 内描边：卡内再收一道 1px 亮边，是"玻璃"质感的关键，此前只有 ThreeCardScene 有 */}
        <div
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: RADIUS.cardInner,
            border: "1px solid rgba(255,255,255,0.6)",
            pointerEvents: "none",
          }}
        />
        {topBar && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 53)})`,
            }}
          />
        )}
        {leftBar && (
          <div
            style={{
              position: "absolute",
              top: 18,
              bottom: 18,
              left: 0,
              width: 6,
              borderRadius: `0 ${RADIUS.pill} ${RADIUS.pill} 0`,
              background: `linear-gradient(180deg, ${accent}, ${alpha(accent, 45)})`,
            }}
          />
        )}
        {icon && (
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              width: ICON_TILE.sm,
              height: ICON_TILE.sm,
              borderRadius: RADIUS.chip,
              background: alpha(accent, 10),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: tileShadow(accent),
            }}
          >
            <Icon name={icon} size={iconInTile(ICON_TILE.sm)} color={accent} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
