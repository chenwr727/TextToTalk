/**
 * 端到端验证：真实文案 → 真实模型 → 分镜 → 每页静帧。
 *
 * 存在的理由：单元测试证明的是"守门逻辑对不对"，证明不了"模型真的能按约束写出能跑的页面"。
 * 这个脚本跑完整链路并打印可核对的指标：
 *   - 大纲选了哪些版式、有没有用生成式版式
 *   - 每页重试了几次（onReset 计数）
 *   - 规划为 code 的页，代码是否一次通过校验（没通过会被降级成 points，这里能看出来）
 *
 * 用法（在仓库根目录）：
 *   npx tsx server/scripts/e2e.mts
 * 产物：
 *   server/out/e2e/storyboard.json   真实分镜（可直接拖进 web 端复盘）
 *   server/out/e2e/<i>-<layout>.png  每页静帧
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFromPlan, generateOutline } from "../src/services/storyboardGenerator.js";
import type { Storyboard, VideoParams } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const renderDir = path.join(repoRoot, "server", "render");
const outDir = path.join(repoRoot, "server", "out", "e2e");
const serveUrl = path.join(renderDir, "out", "bundle");
const FPS = 30;

const DEFAULT_PROMPT = `电动车为什么会烧起来？很多人以为是电池质量差，其实真正的元凶叫热失控。

热失控是一条四步连锁反应：先是电芯内部温度升到 80 摄氏度左右，负极表面的 SEI 膜开始分解；温度继续爬到 120 至 150 摄氏度，隔膜收缩破裂，正负极直接短路；短路瞬间放出巨大电流，温度几分钟内冲到 400 摄氏度以上，电解液汽化喷出；最后整个电池包被引燃，火焰温度可达 1000 摄氏度。

可怕的地方在于，这条链一旦启动就无法靠外部灭火器逆转。所以工程上真正有效的是在链的每一环提前拦截，一共四道防线：

第一道是电芯管理，用一致性分选和温感把电芯差异控制在 20 毫伏以内，从源头减少局部过热；第二道是结构防护，隔热层把热扩散延后到 300 秒以上，泄压阀负责定向排气；第三道是 BMS 预警，靠电压和温度的异常斜率提前 60 秒报警；第四道是整车层面的热扩散隔离，让单个模组起火不蔓延到整个电池包。

从数据上看，加装这四道防线之后，热扩散到整车的时间从原来的 3 分钟延长到 30 分钟以上，乘员逃生窗口扩大了 10 倍。这不是靠更强的电池，而是靠更早的干预。`;

// 换题目：E2E_PROMPT_FILE=server/scripts/prompts/xxx.txt
const PROMPT = process.env.E2E_PROMPT_FILE
  ? readFileSync(path.resolve(repoRoot, process.env.E2E_PROMPT_FILE), "utf-8")
  : DEFAULT_PROMPT;

const params: VideoParams = {
  width: 1920,
  height: 1080,
  fps: FPS,
  tone: "casual",
  narration: false,
  subtitles: true,
  bgm: "none",
  granularity: "medium",
  theme: process.env.E2E_THEME || "tech",
  targetDurationSec: 90,
};

const runRender = (configPath: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("node", [path.join(renderDir, "run-render.mjs"), configPath], {
      cwd: renderDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let err = "";
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}: ${err.slice(-400)}`))));
  });

const main = async () => {
  mkdirSync(outDir, { recursive: true });

  // ---- 1. 真实生成 ----------------------------------------------------------
  // E2E_REUSE=1：复用上次生成的分镜，只重跑静帧（反复调渲染时省额度与时间）
  if (process.env.E2E_REUSE) {
    const saved = JSON.parse(readFileSync(path.join(outDir, "storyboard.json"), "utf-8")) as {
      storyboard: Storyboard;
    };
    console.log("[e2e] 复用上次生成的分镜，跳过模型调用");
    await renderStills(saved.storyboard);
    return;
  }

  const t0 = Date.now();
  let resets = 0;
  // 把重试次数归到"当前在哪一页"，否则只能看到总数，定位不到是哪页在反复
  const retriesBySection = new Map<string, number>();
  let currentSection = "大纲";
  let tokens = 0;
  const sections: string[] = [];
  console.log("[e2e] 开始生成（大纲 + 逐页展开），接的是 .env 里配置的模型…");

  // 拆成两步（等价于 generateStoryboard），好处是能在两遍之间注入实验条件
  const plan = await generateOutline(
    PROMPT,
    (tok) => (tokens += tok.length),
    () => {},
    (label) => {
      sections.push(label);
      currentSection = label;
      console.log(`  · ${label}`);
    },
    params,
    () => {
      resets += 1;
      retriesBySection.set(currentSection, (retriesBySection.get(currentSection) ?? 0) + 1);
    },
  );

  // E2E_FORCE_CODE=<页序号，从 0 起>：强制某页走生成式版式，
  // 用来隔离测量"模型能不能按白名单写出合格组件"，绕开"它愿不愿意选 code"这层变量
  const forceIdx = process.env.E2E_FORCE_CODE != null ? Number(process.env.E2E_FORCE_CODE) : -1;
  if (forceIdx >= 0 && plan.pages?.[forceIdx]) {
    const target = plan.pages[forceIdx];
    console.log(`\n[e2e] 实验：强制第 ${forceIdx + 1} 页使用生成式版式（原版式 ${target.layout}）`);
    Object.assign(target, { layout: "code", art: null, chart: false, table: false });
  }

  const storyboard = await generateFromPlan(
    PROMPT,
    plan,
    params,
    (tok) => (tokens += tok.length),
    () => {},
    undefined,
    (label) => {
      sections.push(label);
      console.log(`  · ${label}`);
    },
    () => {
      resets += 1;
      retriesBySection.set(currentSection, (retriesBySection.get(currentSection) ?? 0) + 1);
    },
  );
  const genMs = Date.now() - t0;

  // ---- 2. 指标 --------------------------------------------------------------
  const planned = plan.pages ?? [];
  console.log("\n===== 生成结果 =====");
  console.log(`耗时 ${(genMs / 1000).toFixed(1)}s，输出 token 字符 ${tokens}，重试 ${resets} 次`);
  if (retriesBySection.size) {
    console.log("重试分布：" + [...retriesBySection].map(([k, v]) => `${k}×${v}`).join("，"));
  }
  console.log(`页数 ${storyboard.pages.length}（大纲规划 ${planned.length}）`);
  console.log("\n页 | 大纲版式 | 实际版式 | art | chart | code | 字幕数 | 时长");
  console.log("---|---------|---------|-----|-------|------|-------|-----");
  storyboard.pages.forEach((p, i) => {
    const plannedLayout = planned[i]?.layout ?? "-";
    const codeState = plannedLayout === "code" ? (p.code ? "✅ 通过" : "❌ 降级") : p.code ? "✅" : "-";
    console.log(
      `${i + 1} | ${plannedLayout} | ${p.layout} | ${p.art ?? "-"} | ${p.chart ? p.chart.type : "-"} | ${codeState} | ${p.captions.length} | ${p.durationSec.toFixed(1)}s`,
    );
  });

  const codePlanned = planned.filter((p) => p.layout === "code").length;
  const codeOk = storyboard.pages.filter((p) => p.layout === "code" && p.code).length;
  console.log(
    `\n生成式版式：规划 ${codePlanned} 页，通过校验 ${codeOk} 页` +
      (codePlanned ? `（通过率 ${Math.round((codeOk / codePlanned) * 100)}%）` : "（本次大纲没有用到）"),
  );

  writeFileSync(path.join(outDir, "storyboard.json"), JSON.stringify({ storyboard, plan }, null, 2));
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        genMs,
        tokens,
        resets,
        sections,
        codePlanned,
        codeOk,
        pages: storyboard.pages.map((p, i) => ({
          index: i + 1,
          plannedLayout: planned[i]?.layout ?? null,
          layout: p.layout,
          art: p.art,
          chart: p.chart?.type ?? null,
          hasCode: !!p.code,
          codeChars: p.code?.length ?? 0,
          captions: p.captions.length,
          durationSec: p.durationSec,
        })),
      },
      null,
      2,
    ),
  );

  if (process.env.E2E_NO_STILLS) {
    console.log("\n[e2e] 已跳过静帧（E2E_NO_STILLS=1）");
    return;
  }

  // ---- 3. 真实静帧 ----------------------------------------------------------
  await renderStills(storyboard);
};

const renderStills = async (storyboard: Storyboard) => {
  const pages = storyboard.pages;
  const inputProps = {
    projectTitle: storyboard.projectTitle,
    pages,
    fps: FPS,
    subtitles: params.subtitles,
    bgm: null,
    theme: params.theme,
    width: params.width,
    height: params.height,
  };

  // 与 shared/types.ts 的 TRANSITION_FRAME_MAP 对齐：转场会重叠前后页
  const TF: Record<string, number> = {
    none: 0,
    fade: 12,
    slide: 18,
    zoom: 15,
    wipe: 18,
    flip: 20,
    cut: 0,
  };
  const starts: number[] = [];
  let offset = 0;
  pages.forEach((p, i) => {
    starts.push(offset);
    const dur = Math.round((p.durationSec || 4) * FPS);
    const next = pages[i + 1];
    offset += dur - (next ? (TF[next.transition ?? "fade"] ?? 12) : 0);
  });

  console.log(`\n[e2e] 渲染 ${pages.length} 张静帧（总帧数 ${offset}）…`);
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const frame = starts[i] + Math.max(20, Math.round(((page.durationSec || 4) * FPS) / 2));
    const name = `${String(i + 1).padStart(2, "0")}-${page.layout}`;
    const outPng = path.join(outDir, `${params.theme}-${name}.png`);
    const configPath = path.join(outDir, `${name}.still.json`);
    writeFileSync(
      configPath,
      JSON.stringify({
        mode: "still",
        serveUrl,
        compositionId: "DynamicVideo",
        output: outPng,
        inputProps,
        frame,
        options: { gl: process.env.RENDER_GL || "swiftshader" },
      }),
    );
    const ts = Date.now();
    try {
      await runRender(configPath);
      console.log(`  ok ${name} (frame ${frame}, ${Date.now() - ts}ms)`);
    } catch (e) {
      console.error(`  FAIL ${name}: ${(e as Error).message}`);
    } finally {
      rmSync(configPath, { force: true });
    }
  }
  console.log(`\n[e2e] 完成 -> ${outDir}`);
};

main().catch((e) => {
  console.error("[e2e] 失败：", e);
  process.exitCode = 1;
});
