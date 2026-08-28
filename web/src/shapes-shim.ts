const empty = (): { path: string; width: number; height: number; transformOrigin: string } => ({
  path: "",
  width: 0,
  height: 0,
  transformOrigin: "0 0",
});

export const makePie = (..._args: unknown[]) => empty();
export const makeStar = (..._args: unknown[]) => empty();
export const makeCircle = (..._args: unknown[]) => empty();
export const makeRect = (..._args: unknown[]) => empty();
export const makeTriangle = (..._args: unknown[]) => empty();
export const makePolygon = (..._args: unknown[]) => empty();
export const makeEllipse = (..._args: unknown[]) => empty();
export const makeHeart = (..._args: unknown[]) => empty();
export const makeSpark = (..._args: unknown[]) => empty();
export const makeArrow = (..._args: unknown[]) => empty();
export const makeCallout = (..._args: unknown[]) => empty();