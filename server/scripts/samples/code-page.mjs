/**
 * 自动生成，请勿手改 —— 源头是 samples/code-page.tsx，
 * 由 node server/scripts/build-sample-code.mjs 用与生产一致的转译选项产出。
 */
export const CODE_PAGE_JS = String.raw`
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GeneratedPage;
const { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } = remotion;
function GeneratedPage({ page, band, }) {
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
            position: "absolute",
            left: band.left,
            top: band.top,
            width: band.right - band.left,
            height: band.bottom - band.top,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            opacity: enter,
        } },
        React.createElement(Kit.Row, { gap: 24, style: { flexWrap: "wrap", justifyContent: "space-between" } }, stats.map((s, i) => (React.createElement(Kit.Card, { key: i, accentIndex: i, style: { flex: 1, minWidth: "30%" } },
            React.createElement(Kit.Stat, { value: s.value, label: s.label, accentIndex: i, size: Kit.FS.hero }))))),
        React.createElement(Kit.Col, { gap: 20, style: { flex: 1 } }, items.slice(0, 4).map((t, i) => (React.createElement(Kit.Card, { key: i, accentIndex: i + 1, style: { flex: 1, display: "flex", alignItems: "center" } },
            React.createElement(Kit.Text, { size: Kit.FS.heading }, t))))),
        React.createElement(Kit.Text, { size: Kit.FS.caption, color: Kit.C.sub }, "\u6570\u636E\u6765\u81EA\u4E0A\u5B63\u5EA6 214 \u6B21\u5BA1\u6279\u8BB0\u5F55")));
}
`;
