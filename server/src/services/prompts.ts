import type { VideoParams } from "../types.js";
import type { PlanBlock } from "./normalize.js";

export function stripPrompt(p: string): string {
  let t = p.trim();
  if (t.length > 8000) t = t.slice(0, 8000);
  return t;
}

const toneDesc: Record<string, string> = { formal: "正式严谨", casual: "轻松易懂", energetic: "活泼有感染力" };
export const tone = (params: VideoParams) => toneDesc[params.tone] ?? toneDesc.casual;

export const ICON_ENUM = '"trend"(趋势)|"chart"(图表)|"clock"(时间)|"scale"(量级)|"gear"(机制)|"bulb"(想法)|"question"(疑问)|"alert"(警告)|"check"(确认)|"search"(搜索)|"target"(目标)|"rocket"(冲刺)|"heart"(情感)|"shield"(防护)|"db"(数据)|"globe"(全球)|"book"(知识)|"bolt"(能量)|"star"(亮点)|"flag"(标记)|"link"(链接)|"users"(人群)|"wallet"(价值)|"box"(容器)|"layers"(层次)|"code"(代码)|"pie"(占比)|"calendar"(日程)|"map"(位置)|"cloud"(云)|"lock"(安全)|"eye"(观察)|"compass"(导航)|"home"(日常)|"award"(奖项)';

const GRANULARITY_DESC: Record<string, string> = {
  coarse: "整体偏精简：pages 取 2~4 个，每页要点 2~3 条，只保留最核心的信息，避免展开细节。",
  medium: "适中：pages 取 4~6 个，每页要点 3~4 条，兼顾完整与精炼。",
  fine: "偏详细：pages 取 6~10 个，每页要点 4~6 条，可适当展开细节与案例。",
};

const PAGE_COUNT_RANGE: Record<string, string> = {
  coarse: "本片页数必须落在 2~4 页之间（含封面/结尾），不得少于 2 页、不得多于 4 页。",
  medium: "本片页数必须落在 4~6 页之间（含封面/结尾），不得少于 4 页、不得多于 6 页。",
  fine: "本片页数必须落在 6~10 页之间（含封面/结尾），不得少于 6 页、不得多于 10 页。",
};

const MAX_PAGES_HINT = "pages 最多 10 个，严禁超过；信息量再大也要合并到 10 页以内，优先保证每页信息密度而非堆页数。";

function contractDesc(params?: VideoParams): string {
  const parts: string[] = [];
  if (params?.audience?.trim()) parts.push(`目标受众：${params.audience.trim()}。所有内容用词、举例、深度都要贴合这个受众，避免超出其认知的术语。`);
  if (params?.coreMessage?.trim()) parts.push(`核心信息：${params.coreMessage.trim()}。整片要始终围绕它展开，结尾要落到它。`);
  if (params?.audienceOutcome?.trim()) parts.push(`观众收获：${params.audienceOutcome.trim()}。结尾页要落到"观众看完能做什么/收获什么"，让整片有明确落点。`);
  return parts.length ? parts.join("\n") : "";
}

function durationHint(params?: VideoParams): string {
  const sec = params?.targetDurationSec;
  if (!sec || sec <= 0) return "";
  const maxPages = Math.max(2, Math.floor(sec / 10)); // 每页约 10 秒，反推页数上限
  return `目标成片时长约 ${sec} 秒。这是硬约束：按每页约 10 秒估算，本片 pages 最多 ${maxPages} 个（含封面/结尾），严禁超过。若信息量超出，就合并信息点、精简每页要点，确保成片落在目标时长附近，不要超时。`;
}

function pageDurationHint(params?: VideoParams, totalPages = 0): string {
  const sec = params?.targetDurationSec;
  if (!sec || sec <= 0 || totalPages <= 0) return "";
  const perPage = Math.round(sec / totalPages);
  const maxCaptions = Math.max(1, Math.min(4, Math.floor(perPage / 4)));
  return `目标成片 ${sec} 秒、共 ${totalPages} 页，本页平均约 ${perPage} 秒。请据此控制篇幅：本页 captions 最多 ${maxCaptions} 条、要点尽量精简，宁可少讲也不要让本页超时。`;
}

const RHYTHM_DESC = `rhythm：本页节奏，**必须且只能从这 3 个值中选一个，严禁写枚举之外的值**："anchor"(重点页，信息密度高、值得观众停留，通常是核心观点/结论页)|"dense"(信息密集页，要点多、节奏快)|"breathing"(过渡/缓冲页，信息少、节奏放缓，用于章节过渡或给观众喘息)。一页大纲里 anchor 页 1~2 个即可，其余多为 dense，breathing 用于过渡。`;

const TRANSITION_DESC = `transition：本页进入时的转场，**必须且只能从这 5 个值中选一个，严禁写枚举之外的值**："fade"（淡入，简单方向）|"slide-left"（从左滑入，适合推进/递进）|"slide-right"（从右滑入，适合回看/对比）|"zoom"（缩放推进，适合重点/高潮页）|"none"（无转场，柔和淡入）。第1页用 "fade" 开场；章节过渡页用 "slide-left" 推进；重点/结论页用 "zoom" 强调；其余多用 "fade"。相邻两页避免用相同方向的 slide。`;

const MOTION_DESC = `motion：本页元素动画风格，**必须且只能从这 3 个值中选一个，严禁写枚举之外的值**："spring"（弹簧回弹，默认，生动有活力）|"linear"（线性平稳，适合数据/图表密集页，避免过度晃动）|"float"（柔和漂浮，适合氛围/过渡页）。默认 "spring"，数据密集页（chart/table/stats）建议 "linear"。`;

const EFFECTS_DESC = `effects：本页视觉特效（可选，默认全关）。annotation：手绘标注，**必须且只能从这 4 个值中选一个，严禁写枚举之外的值**："highlight"（高亮，适合重点句）|"underline"（下划线，适合数字/关键词）|"circle"（圆圈，适合圈出重点）|"none"（无）。pathDraw：是否给装饰线/圆环做描边动画（从无到有"画"出来），只能是 true 或 false。threeD：是否给标题/重点做 3D 翻转入场，只能是 true 或 false。建议：重点/结论页用 annotation 强调；封面/章节页可用 threeD 或 pathDraw 增强开场；数据页少用特效避免干扰。`;

const CUSTOM_SVG_DESC = `customSvg：本页是否用「自定义图形」来可视化（可选，默认 null）。**硬性：若本页大纲已指定 art（如 flow/loop/pyramid/timeline/quadrant/quote），customSvg 必须为 null**——此时用上方 "art" 字段声明关系图类型，让渲染端用标准关系图自动绘制，不要手绘 SVG 与 art 冲突。仅当本页内容适合用"结构图/示意图"表达且现有版式（flow/loop/pyramid/timeline/quadrant/chart/table）都不够直观时才用 customSvg，例如：神经网络结构、分层架构、决策树、中心辐射、矩阵归类、任意自定义示意图。**customSvg 是一个通用 SVG 元素数组，你可以自由组合任意形状，不受预设限制**。坐标基于 1920×1080 画布（x 0~1920，y 0~1080），颜色用 CSS 色值（如 "#3B6FF5"、"rgba(59,111,245,0.3)"、"#fff"）。每个元素结构：
{"type":"circle|rect|ellipse|line|path|polygon|text", ...位置尺寸..., ...样式..., ...动画...}
- circle：{"type":"circle","cx":960,"cy":400,"r":60,"fill":"#3B6FF5"}
- rect：{"type":"rect","x":200,"y":300,"width":300,"height":200,"rx":16,"fill":"#3B6FF5"}
- ellipse：{"type":"ellipse","cx":960,"cy":400,"rx":200,"ry":120,"fill":"#3B6FF5"}
- line：{"type":"line","x1":200,"y1":400,"x2":800,"y2":400,"stroke":"#3B6FF5","strokeWidth":4}
- path：{"type":"path","d":"M 200 400 C 400 200 600 600 800 400","stroke":"#3B6FF5","strokeWidth":4,"fill":"none","draw":true}（draw:true 表示描边动画"画"出来）
- polygon：{"type":"polygon","points":"960,200 1100,500 820,500","fill":"#3B6FF5"}
- text：{"type":"text","x":960,"y":400,"text":"输入层","fontSize":28,"fontWeight":700,"fill":"#1F2937","textAnchor":"middle"}
通用样式：fill（填充色）、stroke（描边色）、strokeWidth（描边宽）、opacity（透明度 0~1）；动画：delay（入场延迟帧，默认 0）、draw（仅 path 用，描边动画）。
**示例：神经网络**（输入3→隐藏4→输出2，节点+连线）：
{"customSvg":[{"type":"line","x1":700,"y1":300,"x2":960,"y2":300,"stroke":"rgba(59,111,245,0.3)","strokeWidth":2},{"type":"line","x1":700,"y1":500,"x2":960,"y2":500,"stroke":"rgba(59,111,245,0.3)","strokeWidth":2},{"type":"circle","cx":700,"cy":300,"r":40,"fill":"#3B6FF5"},{"type":"circle","cx":700,"cy":500,"r":40,"fill":"#3B6FF5"},{"type":"circle","cx":960,"cy":300,"r":40,"fill":"#7C3AED"},{"type":"circle","cx":960,"cy":500,"r":40,"fill":"#7C3AED"},{"type":"text","x":700,"y":620,"text":"输入层","fontSize":26,"fontWeight":700,"fill":"#1F2937","textAnchor":"middle"},{"type":"text","x":960,"y":620,"text":"输出层","fontSize":26,"fontWeight":700,"fill":"#1F2937","textAnchor":"middle"}]}
**要点**：元素数量 2~40 个；先画连线/底层再画节点/文字（后画的盖在上面）；文字要清晰可读（fontSize≥20）；用 2~4 种主题色（蓝 #3B6FF5、紫 #7C3AED、青 #06B6D4、橙 #F59E0B、绿 #10B981、红 #EF4444）区分不同部分；图形会被渲染端自动缩放到安全区域（避开顶部标题和底部字幕），但**请主动把主要内容放在画面中间（y:260~700，x:200~1720），不要把节点/文字放在 y<220 的顶部或 y>780 的底部，避免与标题、字幕、要点条重叠**；**若图形元素较多（如 4 层的漏斗），请纵向压缩排列，保证最底部的元素 y ≤ 760、文字 y ≤ 780，严禁任何元素 y > 780 溢出到字幕区**；若本页不适合画示意图则 "customSvg":null。customSvg 与 art/chart/table 通常互斥：用了 customSvg 就不再给 art/chart/table。**customSvg 与 layout 版式也互斥（硬性）**：一旦本页给了 customSvg，layout 就只能是 "points"（或封面 "title"、结尾 "end"），**严禁再给 steps/three_card/two_column/stats/comparison/map/qa/section 等版式**——渲染端 customSvg 优先，这些版式会被忽略、纯属冗余。判断标准：本页要么用 layout 版式（steps/three_card 等），要么用 customSvg 画图，二选一，绝不叠加。**封面 "title" 与结尾 "end" 页也不要给 customSvg**——渲染端封面/收尾场景优先级最高，这两类页上的 customSvg 不会被画（实测封面整张结构图被静默丢弃），总结图请放到内容页。`;

const MAP_DESC = `map：本页是否用「地图」来可视化（可选，默认 null）。仅当本页内容适合用"地理/空间关系"表达时用，例如：城市/国家分布、路线/航线、区域划分、地理位置对比。**map 是结构化地图数据，渲染端用纯 SVG 离线绘制，不依赖任何在线地图服务**。坐标基于 1920×1080 画布（x 0~1920，y 0~1080），颜色用 CSS 色值（如 "#3B6FF5"）。结构：
{"markers":[{"name":"城市名","x":960,"y":400,"color":"#3B6FF5","size":10}],"routes":[{"from":0,"to":1,"color":"#3B6FF5","dashed":false,"animated":true}],"regions":[{"name":"区域名","points":"0,0 100,0 50,100","color":"#3B6FF5"}]}
- markers：城市/地点标记点，name 是地点名（渲染在点旁），x/y 是画布坐标，color 可选（默认主题色），size 可选（点半径，默认 10）。至少 2 个。
- routes：路线，from/to 是 markers 的下标（连接两个城市），color 可选，type 可选（"rail"高铁/铁路实线、"flight"航线虚线、"road"公路细实线，默认 rail），dashed 可选（true 表示虚线，如航线/示意），animated 可选（默认 true 描边动画"画"出来），flow 可选（默认 true 沿路线流动的小圆点，false 则关闭）。
- regions：区域多边形，points 是顶点字符串（如 "0,0 100,0 50,100"），name 可选（显示在区域中心），color 可选（半透明填充）。
**示例：三条航线连接三个城市**：
{"map":{"markers":[{"name":"北京","x":500,"y":300},{"name":"上海","x":900,"y":500},{"name":"广州","x":700,"y":800}],"routes":[{"from":0,"to":1},{"from":1,"to":2},{"from":0,"to":2,"dashed":true}]}}
**要点**：markers 2~8 个、routes 0~8 条、regions 0~4 个；城市/地点名要短（≤6 字）；坐标要分散开（不要都挤在一起），让地图有空间感；用 2~4 种主题色（蓝 #3B6FF5、紫 #7C3AED、青 #06B6D4、橙 #F59E0B、绿 #10B981、红 #EF4444）区分不同路线/区域；地图会被渲染端自动缩放到安全区域（避开顶部标题和底部字幕），但**请主动把主要内容放在画面中间（y:260~700，x:200~1720），不要把城市点放在 y<220 的顶部或 y>780 的底部，避免与标题、字幕、要点条重叠**；若本页不适合画地图则 "map":null。map 与 art/chart/table/customSvg 通常互斥：用了 map 就不再给这些。`;

const BEST_PRACTICE_DESC = `内容要"为视频而写"，遵循以下最佳实践：
- 标题/要点要短而有力：标题 ≤12 字、要点 8~14 字，方便大字展示与快速阅读；避免长句、从句、堆砌修饰。
- 第一页（封面）要抓人：用一句有冲击力/悬念的开场（hook），点出主题并勾起兴趣，不要平铺直叙。
- 数字/数据要具体：能用数字表达就用数字（如"提升 3 倍"而非"大幅提升"），数据页（chart/stats）尤其如此。
- 图表（chart）必须可读：labels 用简短标签（≤6 字），values 给 0~100 的数值——真百分比直接给（如残值率 [45,65]）；相对强度/倍数等非百分比数据，把最强项缩放为 100、其余按比例（如 5 倍差距给 [100,20]），渲染端会以百分比标签展示；不要给所有值都接近的图。若各值都很小（都 <10）且是占比语义，优先改用 pie。
- 每页只讲一个核心点：一页聚焦一个 idea，不要塞多个主题；要点之间逻辑递进。
- 结尾要落到收获：最后一页（end）给总结或行动号召，让观众看完有明确落点。`;

export function planPrompt(params?: VideoParams): string {
  const g = GRANULARITY_DESC[params?.granularity ?? "medium"] ?? GRANULARITY_DESC.medium;
  const contract = contractDesc(params);
  const duration = durationHint(params);
  return `你是讲解视频的分镜导演。任务：把用户文案规划成一份 PPT 式讲解视频的大纲（只定每页「讲什么 + 用什么结构呈现」，不写具体字幕/正文）。

## 核心原则：一页 = 一个可视化原子
这是统摄全片的最重要原则，请始终用它在脑中判断「该不该拆页/合并」。先看两个正反例，建立直觉：

【正例】文案："热失控有四步：温度升高→隔膜熔化短路→电解液分解→爆炸。"
✅ 正确：只用**一页**（layout="points" + art="flow"），用一句 idea 总述这条因果链（如"热失控是一条四步连锁反应，从升温一路烧到爆炸"），四个环节作为该页的 4 个要点依次排开。
❌ 错误：任何让"第一步""第二步"……单独占一页的写法，或"一页 flow 总览 + 每步再各开一页"的重复结构。

【正例】文案："三款手机：iPhone 5999 元/续航 1 天，小米 3999 元/续航 1.5 天，华为 5499 元/续航 1.2 天。"
✅ 正确：价格+续航合成**一页 table** 交叉矩阵（或一页 chart 分组柱状图）。
❌ 错误：拆成"价格一页 chart + 续航一页 chart"这种连续多张同类图表。

由此抽象出几条规则：
- 一个**完整的结构**（流程图/对比图/柱状图/时间线/循环/漏斗）必须放在**单独一页**里一次讲完——图 + 结论要点同页呈现。
- **不要**把一个结构拆成多页（"先画图、下一页再解读"，或"第一步一页、第二步一页"）。
- **写流程类内容时，用「因果链」的叙述视角，而不是「分步清单」**：把"第一步 A、第二步 B、第三步 C"改写成"从 A 开始，随后 B，最终 C"这种一句总述 + 一页 flow 图承载；不要给每一步各配一个以序数词开头的 idea。
- 多个**同质的小结构**（多个 A vs B 对比、或多个对象 × 多维度清单）要**合并成一页**（comparison 或 table），不要各开一页、每页同一种版式。
- 下一页若还要讲，必须是**全新信息点 / 新数字 / 新角度**（增量结论），而非回头重复上一页的图或数字。
- 判断口诀：写完大纲后逐页看，相邻两页的 layout 或 art 是否雷同？雷同=你大概率把同一件事重复拆了，合并或换角度。

${contract ? `沟通契约：\n${contract}\n` : ""}${duration ? `时长约束：\n${duration}\n` : ""}
## 输出格式
返回【纯 JSON，不要 markdown、不要注释、不要前后缀】：
{
  "projectTitle":"片名",
  "arc":"从哪讲起、如何一步步推进、落在哪（一句）",
  "pages":[{"idea":"本页核心信息（一句话）","chart":false,"table":false,"layout":"points","art":null,"role":"build","icon":null,"rhythm":"dense","transition":"fade","motion":"spring","visual":"本页要画的图的一句话描述，无图则为 null"}]
}

## 页数与节奏
- 内容密度：${g}
- ${PAGE_COUNT_RANGE[params?.granularity ?? "medium"] ?? PAGE_COUNT_RANGE.medium}
- ${MAX_PAGES_HINT}
- 页数按文案信息量自适应，宁少勿多：信息点多才多页，信息少就精简；严禁为凑页数而注水、拆页或重复。只有同一信息点才合并，不要为凑页数拆页。按信息线递进（总述 → 分点 → 案例 等）。

## 字段取值规则
- 【主动可视化】只要一页存在"对比/占比/趋势/流程/循环/层级/分类/清单/金句"等适合可视化的关系，就主动用对应的 chart/art/stats/table/three_card/two_column 来表达，**不要退化成纯文字 points**；仅当这页确实只是并列要点、无任何结构性关系时才用 points。可在一段里交错使用多种结构，让成片丰富。
- 【忠实执行用户点名的图】用户文案若已点名要某种图（"用柱状图对比…""用折线图展示…""画个流程图…"），该页必须如实落地成对应可视化，**严禁降级为 points**，也不得擅自换图。映射：柱状对比→chart(bar)；折线/趋势→chart(line)；占比/拆解→chart(pie)；流程/步骤/因果链→art=flow 或 steps；循环/闭环→art=loop；金字塔/漏斗→chart(pyramid)；结构图/架构→customSvg（并在 visual 说明）；两方对比→comparison。
- layout：每页版式，只能取这 13 个值之一："title"|"section"|"points"|"three_card"|"comparison"|"chart"|"table"|"end"|"two_column"|"steps"|"stats"|"qa"|"map"。按本页内容关系选：封面="title"；章节过渡="section"；并列要点="points"/"three_card"；两方对比="comparison"；有对比/占比数值="chart"；行列矩阵="table"；概念+案例="two_column"；操作步骤/流程="steps"；数据成果="stats"；问答="qa"；地理空间="map"；总结收尾="end"。第1页默认 "title"、结尾默认 "end"、其余默认 "points"；table=true 时 layout="table"。
- 【相邻版式不重复】相邻两页**严禁**连续用同一种强版式（尤其 "chart"/"comparison"/"stats"/"table"/"three_card"），否则视觉单调。若相邻两页撞了，说明你把同质关系重复拆了——按「核心原则」合并，或给后一页换一种版式载体 + 换一个信息角度。示例：文案"油费 1.28 万 vs 电费 1500 元，保养 2000 vs 0，8 年总账 12 万 vs 2 万"——❌ 错误是"油费 comparison + 保养 comparison + 总账 chart"三页同类；✅ 正确的是"油费+保养合成一页 comparison → 总账一页 stats 数据大屏（换载体）"，或"油费 chart → 保养 points 配要点 → 总账 stats"。
- art：本页是否用「关系图」，只能取这 5 个值之一或 null："flow"(先后流程)|"loop"(循环反馈)|"timeline"(分期时间线)|"quadrant"(2x2 象限归类)|"quote"(金句页)。**金字塔/漏斗用 chart(type="pyramid")，不再用 art**。相邻两页也不要连续用同一种 art。
- 【layout 与 art 互斥】一页只用一个"结构载体"：layout 已承担结构（steps/two_column/comparison/three_card/chart/table/map/stats/qa）时 art 置 null；用 art 表达结构时 layout 用 "points"（或 title/end）。二选一，绝不叠加。示例：要画流程时，❌ 不要"layout=steps 且 art=flow"两个都填，✅ 二选一——要么 layout="steps"（art=null），要么 layout="points" + art="flow"。
- role：本页论证角色，只能取这 12 个值之一："hook"|"familiar"|"puzzle"|"build"|"mechanism"|"scale"|"evidence"|"case"|"compare"|"why"|"action"|"end"。第1页常用 "hook"，主体页用 "build/mechanism/scale/evidence/case/compare"，结尾用 "why/action/end"。
- ${RHYTHM_DESC}
- ${TRANSITION_DESC}
- ${MOTION_DESC}
- icon：每页可选一枚语义图标，只能取这些值之一，严禁造枚举之外的值（如 flame/warning/moon 都不在枚举中）：${ICON_ENUM}。没有合适就 null。
- chart：仅当本页有"对比/占比/数值"时为 true。**硬性：原文案必须有具体数字才允许 chart=true**；原文案只有定性描述（无具体数值）时，严禁 chart（会逼展开阶段编数字），改用 points/stats/comparison 如实呈现。
- table：仅当本页适合行列交叉矩阵时为 true。table 与 chart 二选一。
- visual：本页若要用具体一张图表达核心信息，就用一句话写清画什么（如"折线图：冷启动→成长→平台期""热失控四步流程图"）。写了 visual 必须同时给对 layout/art/chart 且三者自洽；**visual 里的对比对象/数据/数字必须全部来自原文案，严禁编造**——原文案只讲了 A 侧就别发明 B 侧，没有可对比的另一方就别用 comparison，改 points/stats 如实呈现。

## 内容质量
${BEST_PRACTICE_DESC}
- 【idea 禁用步骤序数词（硬性）】任何一页的 idea **严禁以"第一步/第二步/首先/其次/然后/接着/最后"等步骤序数词开头**。流程类内容改用"因果链总述"写法：把"第一步 A、第二步 B"改写成一句总述（如"热失控是一条四步连锁反应，从升温一路烧到爆炸"），环节细节放进该页的 visual / 后续展开阶段，而不是让每个环节各占一页。这个约束是为了从源头防止"每步一页"的拆页。
- 第1页（封面）的 idea 必须是一句能让人停下来的钩子：用「你 + 动作/后果/戳痛点」结构，**必须直接对观众说"你"**（如"你天天在做的这件小事，可能正在害你"），落到具体后果/反直觉点；严禁第三人称平铺句。封面 idea 只做总览+钩，不展开细节，不与内容页重叠。
- 除第1页外，每页 idea 也不许只写"讲清楚xx"这种功能句，要给一个"让这页值得看"的点（具体数字/对比、能代入的痛点、或反常识判断）。
- 各页重点彼此区分、递进推进（如 现象→机制→量级→对策），相邻两页不得讲同一主题/数字/结论；同一数字只允许一页作为核心信息点，另一页讲它的成因/影响/对策。
- 结尾页预留：若文案要求结尾落到行动/收获，必须单独预留最后一页（layout="end"），宁合并中间内容页也要保住它。
- arc：一句话讲清整段论证路径（从哪出发→经哪些步骤→落在哪），让各页按此推进而非平铺。

## 自查（交卷前逐条过）
(1) 相邻两页 layout/art 是否雷同？雷同则合并或换角度。(2) 是否把完整流程/对比/图拆成了多页（含"总览图 + 逐步/局部图"）？是则并回一页。(3) 每个关键数字/结论是否只在一页出现？(4) 第1页是否 title 封面、最后页是否 end 结尾？(5) 每个字段取值是否都在枚举内？全部通过才算完成。中文输出。`;
}

function positionHint(index: number, total: number): string {
  if (total <= 1) return "这是全片唯一一页，需自成一体。";
  if (index === 0) return "这是全片第 1 页（共 " + total + " 页），处于开头：负责开场、点题、勾起兴趣，为后续内容做铺垫。";
  if (index === total - 1) return "这是全片最后一页（第 " + total + " 页），处于结尾：负责总结、收束、落到行动或结论。";
  return "这是全片第 " + (index + 1) + " 页 / 共 " + total + " 页，处于中段：负责推进一个具体信息点，承上启下。";
}

export function pagePrompt(
  index: number,
  user: string,
  outline: string,
  prevContent: string,
  following: string,
  block: PlanBlock | undefined,
  params: VideoParams,
  retryHint?: string,
  totalPages?: number
): string {
  const contract = contractDesc(params);
  const pos = positionHint(index, totalPages ?? 0);
  const pageDur = pageDurationHint(params, totalPages ?? 0);
  const layout = block?.layout ?? "points";
  const sceneHookHint =
    index === 1 && (totalPages ?? 0) >= 4 && !["title", "section"].includes(layout)
      ? `- 【场景代入开场（硬性）】本页是全片第一个讲解页：第一条字幕必须以观众代入的具体场景开头（"你肯定遇到过：…"/"想象一下，…"/"刚学完就忘？"式），先让人对号入座，再引出机制/概念。场景要贴合原文案主题，可以口语，但不得虚构原文案没有的人物、数据或事件。`
      : "";
  return `你是资深版式讲解器。用户给了文案和我写好的大纲，负责把第${index + 1}页做成完整的内容页（只讲本页，不越到别的页面）。

【本页位置】${pos}

用户文案：
${user}

大纲：
${outline}

【前文风格参考】请与上一页的语气、用词、承接连贯一致（必要时承接其上文结尾）：
${prevContent}

【后续页安排】下面这些页之后会专门展开，本页标题与内容不得与它们重复或越位：其主题本页最多一句话埋个钩子，严禁展开其细节、数字或结论（观众马上就会听到，提前展开等于剧透+注水）。特别地：若后续页 idea 中已列出具体数字/数据/结论，那些数字就是那一页的主菜，本页【一个都不能提前给出】，只做定性铺垫（如"有实验数据为证，下一页细看"）：
${following || "（没有后续页）"}

请仅针对【本页】idea，展开成完整一页。**铁律：只返回【恰好一个】JSON 对象，多一个、少一个都不行。** 严禁输出多个 JSON 对象拼接、严禁用 markdown 代码块包裹、严禁任何解释性文字或前后缀。你的整个回复必须且只能是下面这一个对象：
${pageOutputTemplate(block)}

${contract ? `沟通契约：\n${contract}\n` : ""}${pageDur ? `本页时长约束：\n${pageDur}\n` : ""}${sceneHookHint ? `本页专属要求：\n${sceneHookHint}\n` : ""}要求：
${pageRules(block, params, retryHint)}`;
}

function pageOutputTemplate(block: PlanBlock | undefined): string {
  const layout = block?.layout ?? "points";
  return `{
  "title":"页标题(<=20字)",
  "points":[{"text":"要点1","icon":"trend"},{"text":"要点2","icon":"chart"}],
  "captions":["字幕句1","字幕句2"],
  "chart":${layout === "chart" ? `{"type":"bar","labels":["A","B"],"values":[100,50],"title":"对比标题"}` : "null"},
  "art":${block?.art ? `"${block.art}"` : "null"},
  "sides":${layout === "comparison" ? `{"a":{"label":"A侧标题","points":[{"text":"A侧要点1","icon":"trend"},{"text":"A侧要点2","icon":"chart"}]},"b":{"label":"B侧标题","points":[{"text":"B侧要点1","icon":"trend"},{"text":"B侧要点2","icon":"chart"}]}}` : "null"},
  "table":${layout === "table" ? `{"headers":["","方案A","方案B"],"rows":[["属性1","…","…"]]}` : "null"},
  "customSvg":${layout === "points" && !block?.art ? `[{"type":"circle","cx":960,"cy":400,"r":60,"fill":"#3B6FF5"},{"type":"text","x":960,"y":400,"text":"节点","fontSize":24,"fill":"#fff","textAnchor":"middle"}]` : "null"},
  "map":${layout === "map" ? `{"markers":[{"name":"北京","x":500,"y":300},{"name":"上海","x":900,"y":500}],"routes":[{"from":0,"to":1}]}` : "null"},
  "effects":{"annotation":"none","pathDraw":false,"threeD":false}
}`;
}

function pageRules(block: PlanBlock | undefined, params: VideoParams, retryHint?: string): string {
  const layout = block?.layout ?? "points";
  const art = block?.art ?? null;
  const rhythm = block?.rhythm ?? "anchor";
  const rhythmHint =
    rhythm === "dense"
      ? "本页是「信息密集页」：要点可给满 4 个、字幕 3~4 条，节奏快、信息量大。"
      : rhythm === "breathing"
        ? "本页是「过渡/缓冲页」：要点少而轻，要点 1~2 个、字幕 1~2 条即可，给观众喘息，不要堆信息。"
        : "本页是「重点页」：信息密度高、值得观众停留，要点 3~4 个、字幕 3~4 条，把核心观点讲透。";

  const parts: string[] = [];
  parts.push(layoutHint(layout));
  if (art) parts.push(artHint(art));
  parts.push(roleHint(block?.role ?? "build"));
  parts.push(roleBoundary(layout, block?.role ?? "build"));
  if (layout === "table") parts.push(tableRule());
  if (layout === "chart") parts.push(chartRule());
  if (layout === "points" && !art) parts.push(CUSTOM_SVG_DESC);
  if (layout === "map") parts.push(MAP_DESC);
  parts.push(EFFECTS_DESC);

  return `- ${parts.join("\n- ")}
- title：本页标题，必须与其它页（含上一页、后续页）标题不同，且概括本页独有的重点。若本页是 "title" 封面版式，起一个总括全片、与内容页区分的大标题。
- captions：画面底部配音语音句，每条语义完整（主谓宾完整、以逗号/句号断），2~4 条；严禁把词/短语硬切两半。每条 8~15 字为宜、最长不超过 20 字。captions 连起来就是本页完整口语解说，配音与字幕都以此为准。
- 【字幕与画面适配（硬性）】captions 必须覆盖本页 points 的关键信息（关键数字、结论、要点），画面讲什么字幕就讲什么；画面里出现的每个关键数字/结论（如"0.1 元/公里""省 1 万"）字幕里都要讲到。字幕条数与画面要点数量大致匹配（要点 3~4 条则字幕 3~4 条）。**严禁"画面有数字、字幕没讲"或"画面 4 条要点、字幕只讲 2 条"的图音脱节**。
- 语气铁律（像"对一个人讲"，不是"念文字"）：(1) 面向观众说话，多用"你 / 我们"，避免全片单向第三人称；(2) 反问/设问/口语惊叹：科普、观点、说服类内容至少一处；但步骤/流程/教程类内容不要硬塞反问，用自然陈述与"你/我们"引导即可；(3) 第 1 页/开场页前一两句字幕必须是"让人停下来看"的钩子（悬念/后果/戳痛点），严禁平铺模板开场（"在当今/如今…"）；(4) 结尾页（end/action）字幕末尾要落一句"能被记住/能立刻行动"的话。检查：若字幕全是陈述句、没有任何"你/我们"或（适合时）反问，就改写成更有"人味"的写法。
- points 2~4 个要点，每个是对象 {"text":"要点内容","icon":"图标枚举"}。icon 必须且只能从下面枚举选一个最能代表该要点语义的（严禁造枚举之外的值，如 flame/warning/moon 都不在枚举中）：${ICON_ENUM}。要点之间 icon 尽量不重复。要点要"具体而有记忆点"，不要泛泛的功能句（"会发热""带来流量"）；尽量带具体数字/参照物/可感知的对比，或观众能代入的痛点/共感。【句式多样化（硬性）】相邻两条要点严禁同构：不得连续两条都是"名词：解释"式，不得连续两条以同一个词开头；在「短语：解释」「完整因果句」「数字/对比句」「场景/动作句」之间切换着写（如"读懂意图：AI 先看邮件"后面接"你只需点头确认，就能发送"，而不是再来一条"自动草拟：按语气生成"）。
- 【跨页去重 + 数字唯一性（硬性）】本页只讲 idea 独有的信息，有且仅有一个"独家信息点"，把它讲透。不得重复上一页已讲内容、不得提前讲后续页内容、不得与上一页 captions 雷同。每个关键数字/结论整片只能在一页作为"核心信息点"出现：若上一页已讲"150°C 触发热失控"，本页就讲"能量量级"或"连锁反应各环节"，不要再写一遍"150°C"；本页引入的新数字/结论也要避免与后续页重复。相邻页应构成"递进"，而非"同一件事换个说法重讲"。自查：若本页任何 captions/要点与上一页在主题/数字/结论上有重叠，就换新角度（案例/数据/对比/后果切入）或删掉。
- 节奏：${rhythmHint}
- 【只输出一个对象（最硬约束）】回复只能有且仅有一个 JSON 对象，以「{」开头、「}」结尾，中间不得再出现第二个「{...}」。若纠结用 art 还是 customSvg，先二选一定下一种再写。一旦出现第二个对象，本次结果作废。
- 【数字真实性（硬性）】关键数字/百分比/统计必须来自原文案：允许对原文数字做纯算术换算或对比（如原文"8小时→15分钟"可以说"快32倍"），但严禁发明原文完全没有的新数字、新比例、新统计（如原文只说"省下一半时间"，就不要写"每天多出4小时""每月省90小时"这类需要额外假设才能算出的数）；也别给要点/图表加原文没有的数据来源或精确到小数的伪精确值。
- 语气 ${tone(params)}；坚持原文案核心事实，不编造；中文输出。${retryHint ? `\n\n【上一版校验未通过，请据此修正后重新生成】\n${retryHint}` : ""}`;
}

function layoutHint(layout: string): string {
  switch (layout) {
    case "title":
      return `本页版式为 "title" 封面页：只做总览式开场（点主题、勾好奇）。**points 最多 2 条短句、captions 1~2 条、全部字幕合计 ≤ 40 字（配音约 8 秒）**，不要展开任何具体数字、结论或细节（会剧透整片）。**封面字幕必须是一句"让人停下来看"的钩子（硬性）**：用「你 + 动作/后果/戳痛点」结构，必须直接对观众说"你"（如"你天天在做的这件小事，可能正在害你"），落到具体后果/反直觉点；严禁平铺第三人称陈述或模板开场（"在当今社会…""如今…"）。`;
    case "section":
      return `本页版式为 "section" 章节过渡：给标题加一句副题，简短点明本章节要讲什么。`;
    case "three_card":
      return `本页版式为 "three_card"：给恰好 3 个并列卡片（别塞第 4 条总结），每卡片一条要点。`;
    case "comparison":
      return `本页版式为 "comparison" 两方对比：必须给 **sides 结构化分组**（渲染端按此直接分左右两栏，不依赖数组顺序）："sides":{"a":{"label":"A侧标题","points":[{"text":"…","icon":"…"}]},"b":{...}}。A/B 两侧各 2~3 条、条数相等，第 k 条 A 与第 k 条 B 讲同一个维度；原文案列出的每个差异点都要保留，不得合并/省略。同时 points 字段仍需给两侧全部要点（先 A 后 B 拼接，作兜底）。**硬性：sides 对比数据必须来自原文案，严禁编造**——原文案只讲了 A 侧就别发明 B 侧数字，B 侧如实写"原文案未给出对比数据"或只写原文案确实提到的内容。`;
    case "chart":
      return `本页版式为 "chart"：以图表为主、points 给图表结论。`;
    case "table":
      return `本页版式为 "table"：以表格为主、points 给表格结论。`;
    case "end":
      return `本页版式为 "end" 收尾：给总结/收尾要点，落到观众能带走的一句话。`;
    case "two_column":
      return `本页版式为 "two_column" 左右图文（概念 + 案例）：**points 必须按"先左栏概念、后右栏案例"的顺序成对给足**（渲染端按 points 顺序分左右两栏），左栏给概念/原理、右栏给对应案例/图文，两栏要点数量尽量对等。注意：若本页要表达的是"两方对比"（A vs B 优劣差异），不要用 two_column，改用 "comparison" 并给 sides。`;
    case "steps":
      return `本页版式为 "steps" 步骤流程：按步骤顺序给足每步（points 按步骤顺序组织，**不要用 customSvg 手绘阶梯**，让渲染端按 steps 版式自动排布）。`;
    case "stats":
      return `本页版式为 "stats" 数据大屏：以醒目数字呈现成果/数据，points 给 2~4 个关键指标。`;
    case "qa":
      return `本页版式为 "qa" 问答：给一个核心问题 + 简洁解答。`;
    case "map":
      return `本页版式为 "map"：以地图为主、points 给地图结论。`;
    default:
      return `本页版式为 "points" 并列要点：用 2~4 条要点讲清本页 idea。`;
  }
}

function artHint(art: string): string {
  switch (art) {
    case "flow":
      return `本页 art 为 "flow"：给先后步骤要点（通常 3~4 个，流程本有 5~6 步则如实给满，不要砍）。`;
    case "loop":
      return `本页 art 为 "loop"：给循环环节要点（环节有几个给几个，不要砍）。`;
    case "timeline":
      return `本页 art 为 "timeline"：给按时序的要点。`;
    case "quadrant":
      return `本页 art 为 "quadrant"：给 4 个按归类的要点。`;
    case "quote":
      return `本页 art 为 "quote" 引言页：points[0] 放一句可独立成页的核心观点/金句（完整一句话，8~20 字），points[1] 放署名/出处，captions 给 1~2 条与金句呼应的字幕。`;
    default:
      return "";
  }
}

function roleHint(role: string): string {
  const map: Record<string, string> = {
    hook: "用问题/悬念开场勾起好奇",
    familiar: "从观众已熟悉之物讲起",
    puzzle: "制造让观众好奇的疑问",
    build: "一次讲清基础概念",
    mechanism: "讲它如何运作（因果/步骤）",
    scale: "用量级或数字把抽象讲实",
    evidence: "给出可验证的证据/数据",
    case: "给贴近生活的具体案例",
    compare: "把两方讲清差异",
    why: "讲为何重要/价值",
    action: "给明确行动或呼吁",
    end: "收束总结",
  };
  return `本页论证角色为「${role}」：${map[role] ?? "一次讲清基础概念"}。写具体、说人话。`;
}

function roleBoundary(layout: string, role: string): string {
  const isBody = ["mechanism", "scale", "evidence", "case", "build"].includes(role) || layout !== "end";
  if (isBody && role !== "action") {
    return `分工边界：本页是主体讲解页，只讲清"是什么/如何运作/量级多大/后果如何"，**不要给行动建议/号召/该怎么做**（如"请放到安全的地方""今晚就改"），这类收尾呼吁留给 role="action" 或 layout="end" 的最后一页。`;
  }
  if (role === "action") {
    return `分工边界：本页是行动页，只给**具体可执行的操作步骤**（如"放在硬质桌面""保持通风""远离易燃物"），**不要写总结性号召/升华金句**（如"安全无小事""别让方便酿成大祸"）——这类收束升华是 role="end" 最后一页的职责。`;
  }
  return "";
}

function tableRule(): string {
  return `本页大纲要求用表格（table=true），必须返回 "table":{"headers":["","方案A","方案B"],"rows":[["属性1","…","…"]]}，且该页不再给 chart。表格数据要来自原文案，不编造。`;
}

function chartRule(): string {
  return `本页返回一个图表，含 type、labels、values、title 等字段。type 从 8 种选：bar(柱状对比)/line(折线走势)/pie(饼图占比)/pyramid(金字塔漏斗)/area(面积图)/donut(环形图)/stacked-bar(堆叠柱状图)/scatter(散点图)。values 给 0~100：真百分比直接给（如 45、65）；相对强度/倍数把最强项缩放为 100、其余按比例（如 5 倍差距给 100 和 20）。labels 与 values 数量一致，各 2~6 个。pyramid 用于「逐层流失/递减」漏斗（labels 给每层名、values 给每层数值，如 获客/激活/留存/变现 → 100/60/35/15）。stacked-bar 用 series 多系列（每项 {name, values}）。scatter 用 points 点数组（每项 {x, y, label?}）。**硬性：图表数据必须来自原文案，严禁编造**——原文案没给具体数字就别硬造，改 points/stats 如实呈现；**图表数据必须与本页旁白/要点关键数字严格一致**，严禁"旁白讲 1.1℃、图表画 0~0.6"的图音脱节。`;
}

export function fallbackPrompt(params: VideoParams): string {
  return `你是讲解视频的分镜导演。把下面的用户文案做成一份完整 PPT 讲解视频分镜，返回【纯 JSON】：
{"projectTitle":"片名","pages":[{"title":"...","points":[...],"captions":[...],"chart":null}]}
- pages 数量按文案信息量取 2~6 个
- captions：每条字幕完整、以标点断，2~4/页（画面底部配音字幕句）。
- points 2~4 个要点。
- chart：仅当有对比/占比适合柱状图才给 bar，否则 null。
- 语气：${tone(params)}；坚持原文事实；中文输出。`;
}

export function regeneratePrompt(
  index: number,
  user: string,
  prevContent: string,
  following: string,
  keepArt: string | null,
  keepTitle: string,
  params: VideoParams,
  retryHint?: string,
  keepLayout: string = "points",
  keepRole: string = "build",
  keepIcon: string | null = null
): string {
  const block: PlanBlock = {
    layout: keepLayout as PlanBlock["layout"],
    art: keepArt as PlanBlock["art"],
    role: keepRole as PlanBlock["role"],
    icon: keepIcon as PlanBlock["icon"],
    table: keepLayout === "table" ? true : false,
    chart: keepLayout === "chart" ? true : false,
  };
  return `你是讲解视频的分镜导演。用户之前生成了分镜，现在只需【重新生成第 ${index + 1} 页】，其它页保持不变，不要涉及别页的内容。

用户文案：
${user}

【前文风格参考】请与上一页的语气、用词、承接连贯一致（必要时承接其上文结尾）：
${prevContent}

【后续页安排】下面这些页之后会专门展开，本页标题与内容不得与它们重复或越位：其主题本页最多一句话埋个钩子，严禁展开其细节、数字或结论：
${following || "（没有后续页）"}
原第 ${index + 1} 页标题：${keepTitle}

请仅针对【本页】，重做这一页。**铁律：只返回【恰好一个】JSON 对象。** 严禁输出多个 JSON 对象拼接、严禁用 markdown 代码块包裹、严禁任何解释性文字或前后缀。你的整个回复必须且只能是下面这一个对象：
${pageOutputTemplate(block)}

要求：
${pageRules(block, params, retryHint)}`;
}