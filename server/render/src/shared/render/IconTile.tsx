import React from "react";
import { alpha, ICON_TILE, iconInTile, RADIUS, tileShadow } from "./theme";
import { Icon } from "./Icon";

/**
 * 图标方块：卡片/要点行左侧那个"图标底片"。
 *
 * 此前 6 个场景各写一份：44/48/52/56/64/76 六种尺寸，12/14/16/chip 四种圆角，
 * 有的带投影有的没有，底色 8% 与 10% 混用。统一到这里，只保留三档尺寸。
 */
export const IconTile: React.FC<{
  name?: string | null;
  accent: string;
  size?: keyof typeof ICON_TILE;
  /** 传 'solid' 得到实心主色底（深色主题下更醒目），默认淡色底 */
  variant?: "soft" | "solid";
  style?: React.CSSProperties;
}> = ({ name, accent, size = "md", variant = "soft", style }) => {
  const box = ICON_TILE[size];
  const solid = variant === "solid";
  return (
    <div
      style={{
        width: box,
        height: box,
        flex: "0 0 auto",
        borderRadius: RADIUS.chip,
        background: solid ? accent : alpha(accent, 10),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: solid ? tileShadow(accent) : undefined,
        ...style,
      }}
    >
      {name ? (
        <Icon name={name} size={iconInTile(box)} color={solid ? "#ffffff" : accent} />
      ) : (
        <span style={{ color: accent, fontWeight: 700, fontSize: iconInTile(box) }}>•</span>
      )}
    </div>
  );
};
