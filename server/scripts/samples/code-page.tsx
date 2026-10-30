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

/*
 * 签名换成 `{ page, band }`：服务端现在有硬规则——生成代码不提 `band`/`portrait` 会被打回重写（→ 降级 points）。
 * 样本也得跟着走新契约：位置全部从 `band` 算。原来是「居中 + wrap」，
 * 竖屏实测只占 884..1199（fill 32%），横屏也只用了中间一段。
 */
export default function GeneratedPage({
  page,
  band,
}: {
  page: StoryPage;
  band: { top: number; bottom: number; left: number; right: number };
}) {
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
        /* 位置全部从 band 推出来：已避开标题与字幕，不写任何像素常量 */
        position: "absolute",
        left: band.left,
        top: band.top,
        width: band.right - band.left,
        height: band.bottom - band.top,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: enter,
      }}
    >
      {/* 标题由渲染端统一画（PageHeading），这里不再重复 Kit.Heading */}
      <Kit.Row gap={24} style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        {stats.map((s, i) => (
          <Kit.Card key={i} accentIndex={i} style={{ flex: 1, minWidth: "30%" }}>
            <Kit.Stat value={s.value} label={s.label} accentIndex={i} size={Kit.FS.hero} />
          </Kit.Card>
        ))}
      </Kit.Row>
      {/* 每张卡自己 `flex: 1` 撑满：中间那一块整体 `flex: 1` + 内容居中会在卡片上下留出 400px+ 的连续空白（实测 418px） */}
      <Kit.Col gap={20} style={{ flex: 1 }}>
        {items.slice(0, 4).map((t, i) => (
          <Kit.Card key={i} accentIndex={i + 1} style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Kit.Text size={Kit.FS.heading}>{t}</Kit.Text>
          </Kit.Card>
        ))}
      </Kit.Col>
      <Kit.Text size={Kit.FS.caption} color={Kit.C.sub}>
        数据来自上季度 214 次审批记录
      </Kit.Text>
    </AbsoluteFill>
  );
}
