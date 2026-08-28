export const LAYOUT_LABEL: Record<string, string> = {
  title: "封面", section: "章节", points: "要点", three_card: "三卡片",
  comparison: "对比", chart: "图表", table: "表格", end: "总结",
  two_column: "左右图文", steps: "步骤流程", stats: "数据大屏", qa: "问答",
};
export const ART_LABEL: Record<string, string> = {
  flow: "流程图", loop: "循环", pyramid: "金字塔", timeline: "时间线", quadrant: "象限", quote: "金句",
};
export const ICON_EMOJI: Record<string, string> = {
  trend: "📈", chart: "📊", clock: "⏰", scale: "⚖️", gear: "⚙️", bulb: "💡",
  question: "❓", alert: "⚠️", check: "✅", search: "🔍", target: "🎯", rocket: "🚀",
  heart: "❤️", shield: "🛡️", db: "🗄️", globe: "🌐", book: "📘",
};
export const ROLE_LABEL: Record<string, string> = {
  hook: "开场", familiar: "铺垫", puzzle: "疑问", build: "概念", mechanism: "机制",
  scale: "量级", evidence: "证据", case: "案例", compare: "对比", why: "价值",
  action: "行动", end: "收尾",
};

export const STAGES = [
  { id: "plan", label: "规划中", color: "#7be0c0" },
  { id: "expand", label: "逐页展开", color: "#7bbff2" },
] as const;