/**
 * 版式样本页：gallery（设计陈列）、probe（DOM 探针）共用同一份数据。
 *
 * 抽出来的理由：探针要复现"某版式在某帧的真实布局"，样本若和 gallery 各写一份，
 * 两边会慢慢漂移，探到的布局也就不是看到的那张图了。
 */
const page = (o) => ({
  pageIndex: 0,
  title: "",
  points: [],
  narration: "",
  captions: ["这是这一页的口播字幕，用来判断字幕条与正文的层级关系。"],
  chart: null,
  durationSec: 8,
  accent: 0,
  ...o,
});

/** 每种版式一页"真实文案"：判断这套版式在真实内容下的观感，而不是空壳好看 */
export const PAGES = [
  page({
    layout: "title",
    role: "hook",
    title: "为什么组织越管越僵",
    points: [{ text: "三个信号，说明流程正在反噬效率" }],
    captions: ["先讲个真事：一家 40 人的公司，审批环节有 11 道。"],
    accent: 0,
  }),
  page({ layout: "section", role: "transition", title: "第一部分 · 症状", accent: 1 }),
  page({
    layout: "points",
    _name: "long",
    title: "流程改造先改这三处",
    points: [
      "把审批链路上每个环节的等待时间单独统计出来，而不是只记总时长，否则永远找不到真正的瓶颈",
      "跨部门协作的第一反应往往是拉个会把人凑齐，而不是先确认对方到底需要什么信息",
      "同一件事被三个人重复审批，说明流程里缺的是信任而不是层级，加人会越走越慢",
      "把决策点前移到离客户最近的人手上，中间层只保留知情权与申诉权",
    ],
    accent: 1,
  }),
  page({
    layout: "points",
    title: "流程反噬效率的三个信号",
    points: [
      { text: "同一件事要过三道审批，每道都在等上一个人" },
      { text: "新人入职两周还没跑通报销流程" },
      { text: "跨部门协作的第一反应是拉会，而不是找人" },
    ],
    accent: 2,
  }),
  page({
    layout: "three_card",
    title: "三种典型的组织病",
    points: [
      { text: "审批链过长，决策被反复上推", icon: "clock" },
      { text: "责任边界模糊，没人愿意拍板", icon: "alert" },
      { text: "信息只在会上流动，落地靠喊", icon: "users" },
    ],
    accent: 3,
  }),
  page({
    layout: "comparison",
    title: "工具型流程 vs 目的型流程",
    comparisonSides: {
      a: { label: "工具型", points: ["流程服务于目标", "例外有明确出口", "审批层级不超过两层"] },
      b: { label: "目的型", points: ["目标服务于流程", "例外一律上报", "层级越多越安全"] },
    },
    accent: 4,
  }),
  page({
    layout: "steps",
    title: "把审批链砍到两层",
    points: [
      { text: "盘点全流程，标出无人负责的节点" },
      { text: "把决策权下沉到直接主管" },
      { text: "给例外情况设置 24 小时兜底出口" },
      { text: "每季度回看一次，删掉不用的环节" },
    ],
    accent: 5,
  }),
  page({
    layout: "stats",
    title: "砍掉中间层之后",
    // StatsScene 从要点文案里抽第一个数字当主视觉，文案本身要带数字才不是空壳
    points: [{ text: "审批时长 1.5 天" }, { text: "周会减少 40%" }, { text: "满意度 +12 分" }],
    accent: 0,
  }),
  page({
    layout: "chart",
    title: "审批环节数与落地周期的关系",
    chart: { type: "bar", title: "落地周期", labels: ["3 环", "6 环", "9 环", "12 环"], values: [7, 14, 23, 38] },
    accent: 1,
  }),
  page({
    layout: "chart",
    title: "人数增长与审批滞留",
    chart: { type: "line", title: "平均滞留天数", labels: ["Q1", "Q2", "Q3", "Q4"], values: [12, 19, 26, 41] },
    accent: 3,
  }),
  page({
    layout: "chart",
    title: "返工量随层级递增",
    chart: { type: "area", title: "月均返工单", labels: ["1 层", "2 层", "3 层", "4 层"], values: [8, 17, 29, 46] },
    accent: 5,
  }),
  // pie / donut 在渲染器与 normalize 里都存在，但此前 gallery 里一个样本都没有——
  // 等于这两个版式从来没被看过一眼。补上样本，横竖两版都要能渲。
  page({
    layout: "chart",
    title: "时间花在哪了",
    chart: {
      type: "pie",
      title: "一周工时分布",
      labels: ["开会", "写文档", "救火", "真做事"],
      values: [26, 18, 22, 34],
    },
    accent: 2,
  }),
  page({
    layout: "chart",
    title: "审批总时长拆解",
    chart: {
      type: "donut",
      title: "一次审批 4.2 天",
      labels: ["等人回", "等开会", "实际处理"],
      values: [58, 27, 15],
    },
    accent: 4,
  }),
  page({
    layout: "chart",
    title: "三块成本逐年变化",
    chart: {
      type: "stacked-bar",
      title: "成本结构（万元）",
      labels: ["2021", "2022", "2023"],
      series: [
        { name: "人力", values: [12, 18, 26] },
        { name: "工具", values: [6, 9, 14] },
        { name: "外包", values: [4, 5, 9] },
      ],
    },
    accent: 4,
  }),
  page({
    layout: "chart",
    title: "规模与周期并不成正比",
    chart: {
      type: "scatter",
      title: "公司规模 / 审批周期",
      points: [
        { x: 20, y: 4, label: "小团队" },
        { x: 80, y: 9, label: "中型" },
        { x: 220, y: 15, label: "大型" },
        { x: 600, y: 22, label: "集团" },
      ],
    },
    accent: 2,
  }),
  page({
    layout: "table",
    title: "三种审批模式的取舍",
    table: {
      headers: ["模式", "决策速度", "风险", "适合场景"],
      rows: [
        ["一人拍板", "最快", "集中", "小金额、高频"],
        ["三人会签", "中等", "分散", "中等风险"],
        ["多层审批", "最慢", "最分散", "合规强约束"],
      ],
    },
    accent: 2,
  }),
  page({
    layout: "table",
    _name: "numeric",
    title: "三种方案的成本对比",
    table: {
      headers: ["方案", "月成本", "人力投入", "上线周期"],
      rows: [
        ["自建", "12000 元", "3 人", "4 个月"],
        ["采购", "38000 元", "1 人", "1 个月"],
        ["外包", "25000 元", "0.5 人", "2 个月"],
      ],
    },
    accent: 3,
  }),
  page({
    layout: "two_column",
    title: "两种改法的代价",
    points: [
      { text: "激进重构" },
      { text: "三个月内推倒重来，短期效率必然下滑" },
      { text: "渐进修剪" },
      { text: "每季度删掉一环，阵痛分摊到日常" },
    ],
    accent: 3,
  }),
  page({
    layout: "qa",
    title: "常见疑问",
    points: [
      { text: "砍层级会不会失控？" },
      { text: "不会。失控来自信息不透明，不来自层级少。把结果指标公开，比多两道审批更有效。" },
    ],
    accent: 4,
  }),
  page({
    layout: "map",
    title: "三个部门的协作断点",
    map: {
      // MapScene 会按点位包围盒自动缩放，这里给"像素级"散布坐标即可
      markers: [
        { name: "产品 · 上海", x: 1180, y: 520 },
        { name: "研发 · 杭州", x: 780, y: 640 },
        { name: "运营 · 成都", x: 420, y: 430 },
      ],
      routes: [
        { from: 0, to: 1, type: "road", animated: true },
        { from: 1, to: 2, type: "road", animated: true },
      ],
    },
    accent: 5,
  }),
  page({
    layout: "end",
    role: "cta",
    title: "好的流程，是让对的人少等一会儿",
    points: [{ text: "下期讲：怎么判断一个流程该删还是该改" }],
    accent: 0,
  }),
];
/**
 * 输出文件名。
 *
 * 同一版式可能有多个样本（四种图表、两种表格、长短两版要点），文件名带上区分后缀，
 * 否则后渲的会覆盖先渲的（chart.png 曾被柱状/折线/面积/散点互相覆盖过）。
 */
export const pageName = (p) =>
  p.chart?.type ? `${p.layout}-${p.chart.type}` : p._name ? `${p.layout}-${p._name}` : p.layout;

