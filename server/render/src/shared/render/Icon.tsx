import { interpolate, useCurrentFrame } from "remotion";
import { C } from "./theme";

const ICON_PATHS: Record<string, string> = {
  trend: "M3 17l5-5 3 3 7-7M14 8h5v5",
  chart: "M4 4v16h16M8 14l3-4 3 2 4-5",
  clock: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2",
  scale: "M5 8h14M12 4v4M8 8h0M12 12l2 6M12 12l-2 6",
  gear: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1",
  bulb: "M12 3a6 6 0 00-6 6c0 3 1.5 4 2 6h8c.5-2 2-3 2-6A6 6 0 0012 3zM10 19h4M11 22h2",
  question: "M12 3a9 9 0 110 18 9 9 0 010-18zM9.5 9a2.5 2.5 0 115 0c0 1.6-2 2-2 3.4M12 16v.6",
  alert: "M12 3l10 18H2L12 3zM12 10v4M12 17.5v.6",
  check: "M4 12l5 5L20 6",
  search: "M11 4a7 7 0 110 14 7 7 0 010-14zM20 20l-4.5-4.5",
  target: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7a5 5 0 110 10 5 5 0 010-10zM12 12l2 2",
  rocket: "M12 3l4 5 2 0 0 0h2V3h-8zM15 8l-3 9 4-4-1 5h-6l3-4",
  heart: "M12 20S3 14.5 3 9.5A4.5 4.5 0 0112 6.3 4.5 4.5 0 0121 9.5C21 14.5 12 20 12 20z",
  shield: "M12 3l7 3v6c0 4-3 8-7 9 5-1.5-7-5-7-9V6zM4 6l8 3 8-3",
  db: "M4 6c0 1.8 3.6 3 8 3s8-1.2 8-3-3.6-3-8-3-8 1.2-8 3zM4 6v12c0 1.8 3.6 3 8 3s8-1.2 8-3V6M4 12c0 1.8 3.6 3 8 3s8-1.2 8-3",
  globe: "M12 3a9 9 0 110 18 9 9 0 010-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15zM4 19.5A2.5 2.5 0 006.5 22H20v-3",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  star: "M12 3l2.5 5.3 5.5.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.5-.8L12 3z",
  flag: "M5 3v18M5 4h11l-2 4 2 4H5",
  link: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  wallet: "M3 6h16a2 2 0 012 2v10a2 2 0 01-2 2H3V6zM16 12h.01M3 9h18",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  layers: "M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 16",
  pie: "M21 12a9 9 0 11-9-9v9h9zM21 12h-9V3a9 9 0 019 9z",
  calendar: "M6 3v3M18 3v3M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  map: "M9 3l6 2 6-2v16l-6 2-6-2-6 2V5l6-2zM9 3v16M15 5v16",
  cloud: "M17.5 19a4.5 4.5 0 000-9 6 6 0 00-11.6 1.5A4 4 0 006 19h11.5z",
  lock: "M5 11h14v10H5zM8 11V8a4 4 0 118 0v3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z",
  compass: "M12 3a9 9 0 110 18 9 9 0 010-18zM15.5 8.5l-2 5-5 2 2-5 5-2z",
  home: "M3 11l9-8 9 8M5 10v11h14V10",
  award: "M12 3a5 5 0 00-5 5 5 5 0 004.5 5 5 5 0 005-5 5 5 0 00-4.5-5zM9 13l-1.5 8L12 18l4.5 3L15 13",
};

export const ICON_KEYS = [
  "trend", "chart", "clock", "scale", "gear", "bulb", "question", "alert",
  "check", "search", "target", "rocket", "heart", "shield", "db", "globe", "book",
  "bolt", "star", "flag", "link", "users", "wallet", "box", "layers", "code",
  "pie", "calendar", "map", "cloud", "lock", "eye", "compass", "home", "award",
];

export const Icon: React.FC<{ name: string; size?: number; color?: string; strokeWidth?: number }> = ({
  name, size = 30, color = C.accent, strokeWidth = 2.1,
}) => {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const IconView: React.FC<{ icon: string; size?: number }> = ({ icon, size = 62 }) => {
  const d = ICON_PATHS[icon];
  if (!d) return null;
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 128, right: 84, width: size, height: size, opacity: o * 0.95 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={C.accent} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
