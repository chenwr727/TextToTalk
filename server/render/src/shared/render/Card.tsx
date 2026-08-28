import { C, CARD_SHADOW, RADIUS, BORDER, GLASS } from "./theme";
import { Icon } from "./Icon";

export const Card: React.FC<{ icon?: string; accent?: string; topBar?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ icon, accent = C.accent, topBar = false, children, style }) => {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{
        position: "relative", height: "100%", background: GLASS.card, border: `${BORDER.card}px solid ${accent}`, borderRadius: RADIUS.card,
        boxShadow: CARD_SHADOW, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "46%", background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 3, borderRadius: RADIUS.card - 3, border: "1px solid rgba(255,255,255,0.6)", pointerEvents: "none" }} />
        {topBar && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />}
        {icon && (
          <div style={{ position: "absolute", top: 26, left: 24, width: 44, height: 44, borderRadius: RADIUS.chip, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${accent}33` }}>
            <Icon name={icon} size={26} color={accent} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};