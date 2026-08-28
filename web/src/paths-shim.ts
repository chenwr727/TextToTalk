export const evolvePath = (_progress: number, _d: string) => ({
  strokeDasharray: "none",
  strokeDashoffset: 0,
});

export const getLength = (_d: string) => 0;
export const getPointAtLength = (_d: string, _length: number) => ({ x: 0, y: 0 });
export const interpolatePath = (_a: string, _b: string, _p: number) => _a;
export const normalizePath = (d: string) => d;
export const parsePath = (d: string) => d;
export const serializeInstructions = (d: unknown) => String(d);
export const translatePath = (d: string) => d;
export const scalePath = (d: string) => d;
export const reversePath = (d: string) => d;
export const resetPath = (d: string) => d;
export const cutPath = (d: string) => d;
export const getSubpaths = (d: string) => [d];
export const getBoundingBox = (_d: string) => ({ x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 });
export const getTangentAtLength = (_d: string, _l: number) => ({ x: 0, y: 0 });
export const getInstructionIndexAtLength = (_d: string, _l: number) => 0;
export const reduceInstructions = (d: unknown) => d;
export const extendViewBox = (d: string) => d;
export const warpPath = (d: string) => d;
export const centerPath = (d: string) => d;
export const PathInternals = { getBoundingBoxFromInstructions: () => ({ x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 }), debugPath: (d: string) => [{ d, color: "#000" }], cutPath: (d: string) => d };