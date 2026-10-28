import React, { Component, useMemo, type ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { StoryPage } from "../props";
import { Kit } from "./kit";
import { PointsScene } from "../scenes/PointsScene";
import { useResponsive } from "../responsive";

/**
 * 注入给生成代码的 remotion 能力面。
 *
 * 故意逐个具名导入而不是 `import * as remotion`：
 * 一是能明确"AI 到底拿到了哪些 API"（就这 6 个），
 * 二是让 shim 覆盖率守护测试逐个校验——web 侧桩没跟上时会直接红灯。
 */
const remotionApi = { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig };

/**
 * 生成式版式的执行端。
 *
 * 服务端已经用 `checkPageCode` 做过 AST 校验与 TSX→JS 转译，这里只负责三件事：
 * 1. **编译一次，缓存住**：`new Function` 按源码字符串缓存，逐帧渲染不会反复编译；
 * 2. **注入白名单**：生成代码能拿到的全部能力就是 React / Kit / remotion 三个参数；
 * 3. **失败不炸片**：编译或运行期任何异常都降级成 points 版式，成片照常出，
 *    而不是让整条流水线因为一页 AI 代码而失败。
 */
/** 生成代码拿到的 props（page / portrait / width / height）都是"字段可能不存在"，用 unknown 值类型就够 */
type GeneratedProps = Record<string, unknown>;

const compiledCache = new Map<string, React.ComponentType<GeneratedProps> | null>();

const compilePage = (js: string): React.ComponentType<GeneratedProps> | null => {
  const cached = compiledCache.get(js);
  if (cached !== undefined) return cached;
  let comp: React.ComponentType<GeneratedProps> | null = null;
  try {
    const factory = new Function(
      "React",
      "Kit",
      "remotion",
      "module",
      "exports",
      `${js}\n;return module.exports && (module.exports.default || module.exports);`,
    );
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    const out = factory(React, Kit, remotionApi, mod, mod.exports);
    const candidate =
      typeof out === "function" ? out : (out as { default?: unknown } | undefined)?.default;
    comp = typeof candidate === "function" ? (candidate as React.ComponentType<GeneratedProps>) : null;
  } catch {
    comp = null;
  }
  compiledCache.set(js, comp);
  return comp;
};

class CodeErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const GeneratedPage: React.FC<{
  page: StoryPage;
  fps: number;
  subtitles: boolean;
  isFirst: boolean;
}> = (props) => {
  const { page } = props;
  /*
   * 版式信息必须传给生成代码。
   *
   * 生成侧的契约长期写的是"画布 1920×1080，用绝对定位排布"，
   * 于是 AI 写出来的页面在竖屏（1080×1920）下横向溢出——实测三张 minWidth:340 的
   * 统计卡排成一行 1132px，超出可用的 952px，左右两张被裁掉一半。
   * 把 portrait / 画布尺寸透传下去，生成代码才有机会自己分支；
   * 不知道这几个字段的老代码照旧工作（值被忽略）。
   */
  const { isPortrait, width, height } = useResponsive();
  const comp = useMemo(() => (page.code ? compilePage(page.code) : null), [page.code]);
  const fallback = <PointsScene {...props} />;
  if (!comp) return fallback;
  const Generated = comp;
  return (
    <CodeErrorBoundary fallback={fallback}>
      <Generated page={page} portrait={isPortrait} width={width} height={height} />
    </CodeErrorBoundary>
  );
};
