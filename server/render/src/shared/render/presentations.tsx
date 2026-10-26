import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

export type ZoomPushProps = {
  /** 进入时的初始放大倍数 */
  scaleIn?: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 「缩放推进」转场：新页从稍大的尺寸推近到 1.0，旧页同时被顶开并淡出。
 *
 * 刻意不用 @remotion/transitions 自带的 zoomBlur / crossZoom —— 那两个走 OffscreenCanvas
 * shader，无头 Chrome 渲染时依赖 canvas 实现，风险大于收益；纯 transform 的表现足够且有保证。
 */
const ZoomPushLayer: React.FC<TransitionPresentationComponentProps<ZoomPushProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const scaleIn = passedProps.scaleIn ?? 1.18;
  const p = clamp01(presentationProgress);
  const entering = presentationDirection === "entering";

  const scale = entering ? interpolate(p, [0, 1], [scaleIn, 1]) : interpolate(p, [0, 1], [1, 1 + (scaleIn - 1) * 0.5]);
  const opacity = entering ? interpolate(p, [0, 0.45, 1], [0, 0.65, 1]) : interpolate(p, [0.5, 1], [1, 0]);

  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, opacity, willChange: "transform, opacity" }}>
      {children}
    </AbsoluteFill>
  );
};

export const zoomPush = (props: ZoomPushProps = {}): TransitionPresentation<ZoomPushProps> => ({
  component: ZoomPushLayer,
  props,
});
