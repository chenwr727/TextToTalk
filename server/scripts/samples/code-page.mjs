/**
 * 自动生成，请勿手改 —— 源头是 samples/code-page.tsx，
 * 由 node server/scripts/build-sample-code.mjs 用与生产一致的转译选项产出。
 */
export const CODE_PAGE_JS = String.raw`
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GeneratedPage;
const { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } = remotion;
function GeneratedPage({ page, portrait }) {
    const f = useCurrentFrame();
    const { fps } = useVideoConfig();
    const enter = spring({ frame: f, fps, config: { damping: 200 } });
    const items = (page.points || []).map((p) => (typeof p === "string" ? p : p.text));
    const stats = [
        { value: "11 道", label: "审批环节" },
        { value: "4.2 天", label: "平均落地周期" },
        { value: "38%", label: "在等人回话" },
    ];
    return (React.createElement(AbsoluteFill, { style: {
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: portrait ? "0 64px" : "0 120px",
            gap: portrait ? 40 : 56,
            opacity: enter,
        } },
        React.createElement(Kit.Heading, { text: page.title }),
        React.createElement(Kit.Row, { gap: portrait ? 24 : 56, style: { marginTop: 24, flexWrap: "wrap", justifyContent: "center" } }, stats.map((s, i) => (React.createElement(Kit.Card, { key: i, accentIndex: i, style: { flex: 1, minWidth: portrait ? 240 : 340 } },
            React.createElement(Kit.Stat, { value: s.value, label: s.label, accentIndex: i, size: portrait ? Kit.FS.title : Kit.FS.hero }))))),
        React.createElement(Kit.Col, { gap: 20, style: { alignItems: "center" } },
            React.createElement(Kit.Row, { gap: 20, style: { flexWrap: "wrap", justifyContent: "center" } }, items.slice(0, 3).map((t, i) => (React.createElement(Kit.Pill, { key: i, text: t, icon: i === 0 ? "clock" : null, accentIndex: i + 1 })))),
            React.createElement(Kit.Text, { size: Kit.FS.caption, color: Kit.C.sub }, "\u6570\u636E\u6765\u81EA\u4E0A\u5B63\u5EA6 214 \u6B21\u5BA1\u6279\u8BB0\u5F55"))));
}
`;
