import { chatStream, type ChatMessage } from "./llmClient.js";
import { stripPrompt, planPrompt, pagePrompt, fallbackPrompt, regeneratePrompt } from "./prompts.js";
import { parsePlan, parseJson, normalizePage, normalizeDirect, validatePlan, validatePageContent, captionOverlapInfo, STRUCTURAL_LAYOUTS, type Plan } from "./normalize.js";
import type { Storyboard, StoryPage, VideoParams, ChartSpec } from "../types.js";

function chartLabels(c: ChartSpec): string[] {
  if (!c) return [];
  if (c.type === "scatter") return c.points.map((p) => p.label ?? "").filter(Boolean);
  if (c.type === "stacked-bar") return c.labels;
  return "labels" in c ? c.labels : [];
}

export async function generateStoryboard(
  prompt: string,
  params: VideoParams,
  onToken?: (tok: string) => void,
  onStage?: (stage: string) => void,
  onPageDraft?: (page: StoryPage, index: number) => void,
  onSection?: (label: string) => void,
  onReset?: () => void
): Promise<{ storyboard: Storyboard; plan: Plan }> {
  const user = stripPrompt(prompt);

  const plan = await generateOutline(prompt, onToken, onStage, onSection, params, onReset);
  if (!plan.pages?.length) return { storyboard: await fallbackDirect(user, params, onToken, onStage, onSection), plan };

  const storyboard = await generateFromPlan(user, plan, params, onToken, onStage, onPageDraft, onSection, onReset);
  return { storyboard, plan };
}

export async function generateOutline(
  prompt: string,
  onToken?: (tok: string) => void,
  onStage?: (stage: string) => void,
  onSection?: (label: string) => void,
  params?: VideoParams,
  onReset?: () => void
): Promise<Plan> {
  const user = stripPrompt(prompt);
  onStage?.("plan");
  onSection?.("规划大纲");
  let plan: Plan = { pages: [] };
  let problems: string[] = [];
  const base = msgPair(planPrompt(params), user);
  let messages = base;
  for (let attempt = 0; attempt < 3; attempt++) {
    const planRaw = await chatStream({ messages, onDelta: onToken });
    plan = parsePlan(planRaw);
    problems = validatePlan(plan);
    if (!problems.length || !plan.pages?.length) break;
    if (attempt === 2) break;
    onReset?.();
    onSection?.(`大纲校验未通过（${problems.length} 项），正在修正`);
    messages = retryMessages(base, planRaw, problems, "其余的页数、页面顺序、projectTitle、arc、每页 idea 一律保持原样，不要重新构思整份大纲。");
  }
  return plan;
}

export async function generateFromPlan(
  prompt: string,
  plan: Plan,
  params: VideoParams,
  onToken?: (tok: string) => void,
  onStage?: (stage: string) => void,
  onPageDraft?: (page: StoryPage, index: number) => void,
  onSection?: (label: string) => void,
  onReset?: () => void
): Promise<Storyboard> {
  const user = stripPrompt(prompt);
  if (!plan.pages?.length) return fallbackDirect(user, params, onToken, onStage, onSection);

  onStage?.("expand");
  const pages: StoryPage[] = [];
  for (let i = 0; i < plan.pages.length; i++) {
    onSection?.(`第 ${i + 1} 页展开`);
    const prev = i === 0 ? null : pages[pages.length - 1];
    const page = await generatePage(user, plan, i, params, prev, pages, onToken, undefined, onReset);
    if (page) {
      pages.push(page);
      onPageDraft?.(page, pages.length - 1);
    }
  }
  if (!pages.length) return fallbackDirect(user, params, onToken, onStage, onSection);

  const MAX_PAGES = 10;
  const trimmed = pages.length > MAX_PAGES;
  const storyboard: Storyboard = { projectTitle: (plan.projectTitle || "我的讲解").slice(0, 22), arc: plan.arc ? String(plan.arc).slice(0, 120) : undefined, pages: pages.slice(0, MAX_PAGES) };
  if (trimmed) onSection?.(`大纲共 ${pages.length} 页，超过上限 ${MAX_PAGES} 页，已保留前 ${MAX_PAGES} 页。`);

  const target = params?.targetDurationSec;
  if (target && target > 0) {
    const total = storyboard.pages.reduce((a, p) => a + (p.durationSec || 4), 0);
    if (total > target * 1.2) {
      onSection?.(`分镜估算总时长约 ${total} 秒，超过目标 ${target} 秒（超 ${Math.round((total / target - 1) * 100)}%）。建议精简中间页要点/字幕，或减少页数，使总时长贴近目标。`);
    }
  }

  return storyboard;
}

async function generatePage(
  user: string,
  plan: Plan,
  index: number,
  params: VideoParams,
  prevPage: StoryPage | null,
  priorPages: StoryPage[],
  onToken?: (tok: string) => void,
  retryHint?: string,
  onReset?: () => void
): Promise<StoryPage | null> {
  const block = plan.pages![index];
  const outline = plan.pages!.map((p, idx) => (idx === index ? `【本页】${p.idea ?? ""}` : `（第${idx + 1}页）${p.idea ?? ""}`)).join("\n");
  const following = plan.pages!
    .map((p, idx) => (idx <= index ? undefined : `第${idx + 1}页「${p.idea ?? ""}」`))
    .filter(Boolean)
    .join("\n");
  const prevContent = prevPage
    ? `上一页标题：${prevPage.title}\n上一页旁白：${prevPage.narration || (prevPage.captions ?? []).join(" ")}\n上一页要点：${(prevPage.points ?? []).map((p) => (typeof p === "string" ? p : p?.text ?? "")).filter(Boolean).join("；") || "（无）"}\n上一页图表：${prevPage.chart ? `${prevPage.chart.type}（${chartLabels(prevPage.chart).join("、")}）` : "无"}`
    : "（此为第 1 页，无上一页）";
  let page: StoryPage | null = null;
  const base = msgPair(pagePrompt(index, user, outline, prevContent, following, block, params, retryHint, plan.pages?.length), user);
  let messages = base;
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await chatStream({ messages, onDelta: onToken });
    const obj = parseJson(raw);
    const multiObj = detectMultiObject(raw);
    const hints: string[] = [];
    if (multiObj) {
      hints.push(`你一次返回了多个 JSON 对象（${multiObj}）。这是严重错误：本页只允许返回【恰好一个】JSON 对象。若你在纠结用 art 还是 customSvg 画图，先二选一定下一种，重新只输出一个对象。`);
    } else if (!obj || !Array.isArray(obj.captions)) {
      hints.push(`返回的内容不是合法的单页 JSON（缺少 captions 数组，或返回了多个对象）。请只返回【一个】合法 JSON 对象，且必须包含 "captions" 字符串数组、标题和要点。`);
    } else {
      const objForNorm = STRUCTURAL_LAYOUTS.has(block.layout ?? "") ? { ...obj, customSvg: null } : obj;
      page = normalizePage(objForNorm, index, block.layout ?? "points", block.art ?? null, block.role ?? null, block.icon ?? null, block.rhythm, block.transition, block.motion, obj.effects);
      const isFinalPage = index === (plan.pages?.length ?? 0) - 1;
      const dup = dedupeCheck(page.captions, pagePointTexts(page), priorPages, isFinalPage);
      if (dup) hints.push(`第 ${index + 1} 页的字幕/要点与前面页面存在重复：${dup}。删除或重写这些重叠内容，换全新角度只讲本页独有的信息点。`);
      if (block.layout === "chart" && !page.chart) hints.push(`本页版式为 chart（图表页），但当前缺少 chart 数据，页面将无法渲染图表。请补充一个合法 chart（type/labels/values/title），数据必须来自原文案、与本页要点关键数字严格一致。`);
      if (block.layout === "table" && !page.table) hints.push(`本页版式为 table（表格页），但当前缺少 table 数据，页面将无法渲染表格。请补充一个合法 table（headers/rows），数据来自原文案。`);
      hints.push(...validatePageContent(page));
    }
    if (!hints.length) break;
    if (attempt === 2) break;
    onReset?.();
    messages = retryMessages(base, raw, hints, "其余的标题、旁白、字幕、要点、图标、版式一律保持原样，不要重新构思整页内容。");
  }
  return page;
}

async function fallbackDirect(user: string, params: VideoParams, onToken?: (t: string) => void, onStage?: (s: string) => void, onSection?: (label: string) => void): Promise<Storyboard> {
  onStage?.("expand");
  onSection?.("兜底 · 一次性生成全部分镜");
  const sys = fallbackPrompt(params);
  const raw = await chatStream({ messages: msgPair(sys, user), onDelta: onToken });
  const obj = parseJson(raw);
  const sb = normalizeDirect(obj);
  const issues: string[] = [];
  sb.pages.forEach((p, i) => {
    const problems = validatePageContent(p);
    if (problems.length) issues.push(`第 ${i + 1} 页「${p.title}」：${problems.join("；")}`);
    if (i === 0) {
      const capCount = (p.captions ?? []).length;
      const narrLen = (p.narration || "").length;
      if (capCount > 2 || narrLen > 60 || (p.points ?? []).length > 2) {
        p.captions = p.captions.slice(0, 2);
        p.narration = p.narration.slice(0, 60);
        p.points = p.points.slice(0, 2);
        issues.push(`第 1 页封面信息过载，已自动精简为 2 条字幕、≤60 字旁白、≤2 条要点。`);
      }
    }
  });
  if (issues.length) onSection?.(`兜底分镜校验提示：${issues.join(" ")}`);
  return sb;
}

export async function regeneratePage(
  originalPrompt: string,
  storyboard: Storyboard,
  targetIndex: number,
  params: VideoParams,
  onToken?: (tok: string) => void,
  onReset?: () => void
): Promise<StoryPage | null> {
  const idx = targetIndex;
  const user = stripPrompt(originalPrompt);
  return regeneratePageRaw(user, storyboard, idx, params, onToken, undefined, onReset);
}

async function regeneratePageRaw(
  user: string,
  storyboard: Storyboard,
  idx: number,
  params: VideoParams,
  onToken?: (tok: string) => void,
  retryHint?: string,
  onReset?: () => void
): Promise<StoryPage | null> {
  const prev = idx > 0 ? storyboard.pages[idx - 1] : null;
  const prevContent = prev
    ? `上一页标题：${prev.title}\n上一页旁白：${prev.narration || (prev.captions ?? []).join(" ")}\n上一页要点：${(prev.points ?? []).map((p) => (typeof p === "string" ? p : p?.text ?? "")).filter(Boolean).join("；") || "（无）"}\n上一页图表：${prev.chart ? `${prev.chart.type}（${chartLabels(prev.chart).join("、")}）` : "无"}`
    : "（这是第 1 页，没有更早的页）";
  const following = storyboard.pages
    .map((p, i) => (i <= idx ? undefined : `第${i + 1}页「${p.title}」`))
    .filter(Boolean)
    .join("\n");
  const keepArt = storyboard.pages[idx]?.art ?? null;
  const keepLayout = storyboard.pages[idx]?.layout ?? "points";
  const keepRole = storyboard.pages[idx]?.role ?? "build";
  const keepIcon = storyboard.pages[idx]?.icon ?? null;
  const keepTable = storyboard.pages[idx]?.table ?? null;
  const keepRhythm = storyboard.pages[idx]?.rhythm ?? "anchor";
  const keepTransition = storyboard.pages[idx]?.transition ?? "fade";
  const keepMotion = storyboard.pages[idx]?.motion ?? "spring";
  const keepEffects = storyboard.pages[idx]?.effects ?? {};
  const priorPages = storyboard.pages.filter((_, i) => i !== idx);

  let page: StoryPage | null = null;
  const base = msgPair(regeneratePrompt(idx, user, prevContent, following, keepArt, storyboard.pages[idx]?.title ?? "", params, retryHint, keepLayout, keepRole, keepIcon), user);
  let messages = base;
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await chatStream({ messages, onDelta: onToken });
    const obj = parseJson(raw);
    const multiObj = detectMultiObject(raw);
    const hints: string[] = [];
    if (multiObj) {
      hints.push(`你一次返回了多个 JSON 对象（${multiObj}）。这是严重错误：本页只允许返回【恰好一个】JSON 对象。若在纠结用 art 还是 customSvg，先二选一定下一种，重新只输出一个对象。`);
    } else if (!obj || !Array.isArray(obj.captions)) {
      hints.push(`返回的内容不是合法的单页 JSON（缺少 captions 数组，或返回了多个对象）。请只返回【一个】合法 JSON 对象，且必须包含 "captions" 字符串数组、标题和要点。`);
    } else {
      let cur = normalizePage({ ...obj, chart: obj.chart ?? null }, idx, keepLayout, keepArt, keepRole, keepIcon, keepRhythm, keepTransition, keepMotion, keepEffects);
      if (cur && keepTable && !cur.table) cur = { ...cur, table: keepTable };
      page = cur;
      const dup = dedupeCheck(page.captions, pagePointTexts(page), priorPages, idx === storyboard.pages.length - 1);
      if (dup) hints.push(`第 ${idx + 1} 页的字幕/要点与其它页面存在重复：${dup}。删除或重写这些重叠内容，换全新角度只讲本页独有的信息点。`);
      hints.push(...validatePageContent(page));
    }
    if (!hints.length) break;
    if (attempt === 2) break;
    onReset?.();
    messages = retryMessages(base, raw, hints, "其余的标题、旁白、字幕、要点、图标、版式一律保持原样，不要重新构思整页内容。");
  }
  return page;
}

function msgPair(sys: string, user: string): ChatMessage[] { return [{ role: "system" as const, content: sys }, { role: "user" as const, content: user }]; }

function retryMessages(base: ChatMessage[], prevRaw: string, problems: string[], keepNote: string): ChatMessage[] {
  return [
    ...base,
    { role: "assistant" as const, content: prevRaw.slice(0, 8000) },
    {
      role: "user" as const,
      content: [
        "你刚才生成的内容未通过校验，具体问题如下：",
        ...problems.map((p, i) => `${i + 1}. ${p}`),
        "",
        "请严格基于你上一条消息里的原文做【最小化修改】：只修正上面被指出的问题项，" + keepNote,
        "只返回一个修正后的 JSON 对象，不要输出任何解释文字。",
      ].join("\n"),
    },
  ];
}

function detectMultiObject(text: string): string | null {
  const t = text.replace(/```json|```/g, "").trim();
  let depth = 0;
  let inStr = false;
  let esc = false;
  let closedObjects = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        closedObjects++;
        if (closedObjects === 2) {
          return "第二个对象以 `" + t.slice(i, i + 60).trim() + "` 开头";
        }
      }
    }
  }
  return null;
}

function pagePointTexts(page: StoryPage): string[] {
  return (page.points ?? [])
    .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
    .filter(Boolean);
}

function dedupeCheck(curCaptions: string[], curPoints: string[], priorPages: StoryPage[], isFinalPage = false): string | null {
  if (!priorPages.length) return null;
  const dups: string[] = [];
  const check = (text: string, kind: string) => {
    if (!text) return;
    for (const pp of priorPages) {
      const threshold = isFinalPage && pp.pageIndex === 0 ? 0.85 : 0.6;
      const prevTexts = [...(pp.captions ?? []), ...pagePointTexts(pp)];
      for (const p of prevTexts) {
        if (!p) continue;
        const { ratio, inter } = captionOverlapInfo(text, p);
        if (ratio >= threshold && inter >= 6) {
          dups.push(`${kind}「${text}」与第 ${pp.pageIndex + 1} 页「${p}」重叠`);
          return;
        }
      }
    }
  };
  for (const c of curCaptions) check(c, "字幕");
  for (const t of curPoints) check(t, "要点");
  return dups.length ? dups.join("；") : null;
}