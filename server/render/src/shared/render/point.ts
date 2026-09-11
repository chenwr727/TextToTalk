import type { Point } from "./props";
import { ICON_KEYS } from "./Icon";

export const pointText = (p: Point, _i: number): string => (typeof p === "string" ? p : p.text);
export const pointIcon = (p: Point, i: number): string => (typeof p === "object" && p.icon) || ICON_KEYS[i % ICON_KEYS.length];
export const pointAnchor = (p: Point): number | undefined => (typeof p === "object" ? p.anchor : undefined);
export const pointsText = (ps: Point[]): string => ps.map((p, i) => pointText(p, i)).filter(Boolean).join(" · ");
export const firstPointText = (ps: Point[]): string => (ps[0] ? pointText(ps[0], 0) : "");
