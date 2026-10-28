/**
 * `code` 版式的 gallery 样本（AI 生成整页的那种）。
 *
 * 这份 TSX 不会被直接渲染：它要先经过 `server/src/services/codePage.ts` 里
 * 与生产完全相同的 `ts.transpileModule`（jsx: React、module: CommonJS），
 * 产物写进 `code-page.mjs`，再由 gallery 当作 `page.code` 交给 `GeneratedPage` 执行。
 *
 * 之所以绕这一圈：`GeneratedPage` 用 `new Function` 跑的是**转译后的 JS**，
 * 手写 JSX 进去根本跑不起来；手写一份等价的 JS 又和真实产出不像，样本就失去意义了。
 *
 * 约束（与生产一致）：只能用注入的 `React` / `Kit` / `remotion`，以及 `page`；
 * 只允许一个 default export。
 */
import type { Point, StoryPage } from "../../render/src/shared/render/props";

const { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } = remotion;

export default function GeneratedPage({ page, portrait }: { page: StoryPage; portrait?: boolean }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200 } });
  const items = (page.points || []).map((p: Point) => (typeof p === "string" ? p : p.text));
  const stats = [
    { value: "11 道", label: "审批环节" },
    { value: "4.2 天", label: "平均落地周期" },
    { value: "38%", label: "在等人回话" },
  ];

  return (
    <AbsoluteFill
      style={{
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: portrait ? "0 64px" : "0 120px",
        gap: portrait ? 40 : 56,
        opacity: enter,
      }}
    >
      <Kit.Heading text={page.title} />
      {/* 横竖屏共用一份排布：靠 wrap + flex 自适应，而不是给两个方向各写一套 */}
      <Kit.Row gap={portrait ? 24 : 56} style={{ marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {stats.map((s, i) => (
          <Kit.Card key={i} accentIndex={i} style={{ flex: 1, minWidth: portrait ? 240 : 340 }}>
            <Kit.Stat value={s.value} label={s.label} accentIndex={i} size={portrait ? Kit.FS.title : Kit.FS.hero} />
          </Kit.Card>
        ))}
      </Kit.Row>
      <Kit.Col gap={20} style={{ alignItems: "center" }}>
        <Kit.Row gap={20} style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {items.slice(0, 3).map((t, i) => (
            <Kit.Pill key={i} text={t} icon={i === 0 ? "clock" : null} accentIndex={i + 1} />
          ))}
        </Kit.Row>
        <Kit.Text size={Kit.FS.caption} color={Kit.C.sub}>
          数据来自上季度 214 次审批记录
        </Kit.Text>
      </Kit.Col>
    </AbsoluteFill>
  );
}
