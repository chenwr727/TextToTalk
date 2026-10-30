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
 *
 * 自动体检（默认开启，`E2E_NO_AUDIT=1` 关掉）：
 *   静帧与成片抽帧都会算「墨迹 bbox 占比 / bbox 内最长连续空白 / 墨迹密度」。
 *   这套指标是上一轮量真片时临时写的：它抓到过一个 bbox 填充率 65%、
 *   但页面中间有 620px 空洞的 quote 页。只看填充率会把这种页当成正常页。
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFromPlan, generateOutline } from "../src/services/storyboardGenerator.js";
import type { TimedPage } from "../src/services/renderService.js";
import { measureInk, auditVerdict, bodyBand, robustSpread, type FrameMetrics } from "../src/services/frameAudit.js";
import type { BodyGeometry } from "../render/src/shared/render/bodyGeometry.js";
import { TRANSITION_FRAME_MAP } from "../../shared/types.js";
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

// 竖屏（1080×1920）：`E2E_PORTRAIT=1`。版式修复大多是竖屏专属的，得能按竖屏跑一遍
const PORTRAIT = !!process.env.E2E_PORTRAIT;

const params: VideoParams = {
  width: PORTRAIT ? 1080 : 1920,
  height: PORTRAIT ? 1920 : 1080,
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

  // 只体检已有成片（不重新生成/渲染）：
  //   E2E_AUDIT_MP4=server/out/xxx.mp4 npx tsx server/scripts/e2e.mts
  // 页时长从同名的 `<mp4>.pages.json` 读（渲染时会自动写出）。
  if (process.env.E2E_AUDIT_MP4) {
    // 路径先按当前目录找，找不到再往仓库根目录算：
    // 这个脚本习惯在 server/ 下跑，`out/x.mp4` 是相对 server/ 的
    const given = process.env.E2E_AUDIT_MP4;
    const mp4 = existsSync(path.resolve(given)) ? path.resolve(given) : path.resolve(repoRoot, given);
    const pagesJson = process.env.E2E_AUDIT_PAGES || `${mp4}.pages.json`;
    if (!existsSync(pagesJson)) throw new Error(`找不到页时长文件 ${pagesJson}（可用 E2E_AUDIT_PAGES 指定）`);
    const pages = JSON.parse(readFileSync(pagesJson, "utf-8")) as TimedPage[];
    await auditMp4(pages, mp4);
    return;
  }

  // ---- 1. 真实生成 ----------------------------------------------------------
  // E2E_REUSE=1：复用上次生成的分镜，只重跑静帧（反复调渲染时省额度与时间）
  if (process.env.E2E_REUSE) {
    const saved = JSON.parse(readFileSync(path.join(outDir, "storyboard.json"), "utf-8")) as {
      storyboard: Storyboard;
    };
    console.log("[e2e] 复用上次生成的分镜，跳过模型调用");
    await renderStills(saved.storyboard);
    /*
     * 复用时也要体检。
     *
     * 漏掉这一步的后果实测过：连跑三轮"复用分镜调渲染"，控制台里全是 `ok 0X-xxx`，
     * 一条 fill/空洞都没有——等于零反馈盲调。合成路径（第 3 步）本来就是 render + audit 成对的，
     * 这里必须一样。
     */
    await auditStills(saved.storyboard);
    await renderMp4(saved.storyboard);
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

  // ---- 3. 真实静帧 ----------------------------------------------------------
  // E2E_NO_STILLS=1 只跳过静帧这一步；成片仍要走（曾经写成 return，连 MP4 一起跳过了）
  if (process.env.E2E_NO_STILLS) {
    console.log("\n[e2e] 已跳过静帧（E2E_NO_STILLS=1）");
  } else {
    await renderStills(storyboard);
    await auditStills(storyboard);
  }

  await renderMp4(storyboard);
};

// E2E_MP4=1：继续走配音 + BGM + Remotion 成片，验证到最后一道工序
const renderMp4 = async (storyboard: Storyboard) => {
  if (process.env.E2E_MP4) {
    const { renderTaskSync } = await import("../src/services/renderService.js");
    console.log("\n[e2e] 开始配音与成片渲染（这一步最慢）…");
    const taskId = `e2e-${Date.now()}`;
    const t = Date.now();
    /** 渲染时真正用的页（带配音时长）——后面抽帧体检靠它对齐页边界 */
    let timedPages: TimedPage[] = [];
    const opts = {
      theme: params.theme,
      width: params.width,
      height: params.height,
      voice: process.env.E2E_VOICE,
      engine: process.env.E2E_ENGINE,
      onPages: (pages: TimedPage[]) => {
        timedPages = pages;
      },
    };
    const renderOnce = (sb: Storyboard) =>
      renderTaskSync(
        taskId,
        sb,
        FPS,
        true,
        false,
        (p) => {
          if (Math.round(p * 100) % 20 === 0) console.log(`  进度 ${Math.round(p * 100)}%`);
        },
        (w) => console.log(`  ⚠ ${w}`),
        opts,
      );
    // Remotion 是按 HTTP 地址去拉配音音频的（`${publicBaseUrl}/api/media/...`），
    // 后端不在就跑出 ECONNREFUSED —— 这一步自己把后端拉起来，让 `E2E_MP4=1` 保持一条命令。
    const api = await ensureApi();
    let outMp4: string;
    try {
      outMp4 = await renderOnce(storyboard);
    } catch (e) {
      const msg = (e as Error).message;
      /*
       * 配音引擎挂掉时不要让整条验证链断在最后一步。
       *
       * 实测：edge 引擎被上游 403 挡掉后，`TTS 全部 N 句合成失败` 会直接抛出，
       * 于是"验证渲染"这件事整个跑不下去——而版式问题跟有没有配音无关。
       * 所以这里退一步：去掉 sentences（时长回落到 durationSec）重渲一次静音版，
       * 明确打印降级，避免把"配音失败"当成"渲染失败"。
       */
      if (!/TTS 全部|合成失败/.test(msg) || process.env.E2E_NO_SILENT_FALLBACK) throw e;
      console.log(`\n[e2e] ⚠ 配音全部失败，降级为静音成片继续验证版式：${msg.slice(0, 120)}`);
      const silent: Storyboard = {
        ...storyboard,
        pages: storyboard.pages.map((p) => ({ ...p, sentences: undefined })),
      };
      outMp4 = await renderOnce(silent);
    } finally {
      api?.kill();
    }
    console.log(`[e2e] MP4 完成（${((Date.now() - t) / 1000).toFixed(0)}s）-> ${outMp4}`);
    // 存下「真正入渲染的页时长」，下次可以 E2E_AUDIT_MP4 直接复盘而不用重渲
    if (timedPages.length) {
      writeFileSync(`${outMp4}.pages.json`, JSON.stringify(timedPages, null, 2), "utf-8");
    }
    await auditMp4(timedPages.length ? timedPages : (storyboard.pages as TimedPage[]), outMp4);
  }
};

/* ------------------------------------------------------------ 后端守护 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const probe = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * 确保后端在它自己认为的端口上跑着（已在跑就不动）。
 *
 * 返回我们自己拉起来的子进程（没拉就返回 null），由调用方 finally 关掉。
 */
const ensureApi = async (): Promise<import("node:child_process").ChildProcess | null> => {
  const port = Number(process.env.PORT || 4000);
  const health = `http://127.0.0.1:${port}/api/health`;
  if (await probe(health)) {
    console.log(`[e2e] 沿用已在跑的后端（:${port}）`);
    return null;
  }
  console.log(`[e2e] 为了让 Remotion 拉得到配音音频，临时起一个后端（:${port}）…`);
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.join(repoRoot, "server"),
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, PORT: String(port) },
  });
  for (let i = 0; i < 60; i++) {
    if (await probe(health)) return child;
    if (child.exitCode !== null) break;
    await sleep(500);
  }
  child.kill();
  throw new Error(`后端没能在 :${port} 起来（端口被占？）`);
};

/* ---------------------------------------------------------------- 体检 */

const FFMPEG = process.env.E2E_FFMPEG || "ffmpeg";

const runFfmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    let err = "";
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-300)}`)),
    );
  });

/**
 * 用 ffmpeg 把画面导成灰度原始字节再自己算指标。
 *
 * 不自带 PNG 解码器：`server` 包没有图像库，而 ffmpeg 是渲染链路的硬依赖，
 * `-f rawvideo -pix_fmt gray` 出来就是"每像素 1 字节、逐行"的裸数据，直接可以算。
 */
const extractGray = async (input: string, seekSec: number | null, w: number, h: number): Promise<Uint8Array | null> => {
  const tmp = path.join(outDir, `.audit-${Date.now()}-${Math.random().toString(36).slice(2)}.raw`);
  const args = ["-v", "error"];
  if (seekSec !== null) args.push("-ss", seekSec.toFixed(3));
  args.push("-i", input, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", tmp);
  try {
    await runFfmpeg(args);
    const buf = readFileSync(tmp);
    if (buf.length < w * h) return null;
    return new Uint8Array(buf.subarray(0, w * h));
  } finally {
    rmSync(tmp, { force: true });
  }
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * 从浏览器日志里取最后一条 `TTT_BODY`（渲染端 BodyProbe 回传的真实几何）。
 * 没有就返回 null——不猜、不补默认值。
 */
const readBodyGeometry = (logPath: string): BodyGeometry | null => {
  if (!existsSync(logPath)) return null;
  let last: BodyGeometry | null = null;
  for (const line of readFileSync(logPath, "utf8").split("\n")) {
    const text = line.trim();
    if (!text) continue;
    let msg = text;
    try {
      const outer = JSON.parse(text) as { text?: string };
      if (typeof outer.text === "string") msg = outer.text;
    } catch {
      /* 非 JSON 行当纯文本处理 */
    }
    const at = msg.indexOf("TTT_BODY ");
    if (at < 0) continue;
    try {
      const g = JSON.parse(msg.slice(at + "TTT_BODY ".length)) as BodyGeometry;
      if (g.bodyTop == null) continue;
      last = g;
    } catch {
      /* 截断行跳过 */
    }
  }
  return last;
};

const reportOne = (
  label: string,
  m: FrameMetrics,
  w: number,
  h: number,
  portrait: boolean,
  layout?: string,
  geom?: BodyGeometry | null,
) => {
  /*
   * 几何也要传进判据。
   * 之前只打印不传，于是 e2e 的告警还是像素口径，与 gallery 体检不一致。
   */
  const verdicts = auditVerdict(m, w, h, portrait, { band: bodyBand(w, h), layout, geometry: geom });
  const bad = verdicts.some((v) => v.level === "warn");
  console.log(
    `  ${bad ? "✗" : "·"} ${label.padEnd(24)} fill ${pct(m.fill).padStart(4)}  空洞 ${String(m.voidPx).padStart(4)}px  密度 ${pct(m.inkRatio).padStart(4)}`,
  );
  for (const v of verdicts) console.log(`      ${v.level === "warn" ? "!" : "-"} ${v.message}`);

  /*
   * 布局几何（渲染端回传）：像素口径分不清“卡片顶在标题下、卡内文字偏下”与“整块内容漂在画布中间”——
   * 两者墨迹口径可能都是 200px 空洞。这里直接量 DOM：标题底 → 正文顶的真实距离。
   */
  /*
   * 不再在这里自己判「标题底 → 正文顶 > 120」。
   *
   * 那一段是判据的副本：它没带竖屏的双路径规则，于是同一张尾页
   * 在 gallery 里「不告警」、在 e2e 里叫「空隙 471px 超标」。判据统一交给
   * `auditVerdict`（已接收 DOM 几何 + 版式 + 横竖屏），这里只负责把数字打出来。
   */
  const layoutBad = false;
  /*
   * 没标题的页（封面/章节/尾页）也要把几何打出来：
   * 之前只打「标题底 → 正文顶」，标题为空就什么都不说，看着像探针没跑通。
   */
  if (geom && geom.bodyTop == null && geom.bodyBottom == null) {
    console.log(`      - （探针没量到正文块）`);
  } else if (geom && geom.headingBottom == null && geom.bodyTop != null) {
    const tail = geom.captionTop != null ? `，字幕顶 ${geom.captionTop}` : "";
    console.log(`      - 无标题（正文 ${geom.bodyTop}..${geom.bodyBottom}${tail}）`);
  } else if (geom && geom.headingBottom != null && geom.bodyTop != null) {
    const gap = Math.round(geom.bodyTop - geom.headingBottom);
    const tail = geom.captionTop != null ? `，末尾正文底 ${geom.bodyBottom} / 字幕顶 ${geom.captionTop}` : "";
    console.log(`      - 标题底 ${geom.headingBottom} → 正文顶 ${geom.bodyTop}（空隙 ${gap}px）${tail}`);
  }
  return bad || layoutBad;
};

/** 静帧体检：每页一张，取 mid 帧（与 renderStills 的取帧位置一致） */
const auditStills = async (storyboard: Storyboard) => {
  if (process.env.E2E_NO_AUDIT) {
    console.log("\n[e2e] \u5df2\u8df3\u8fc7\u9759\u5e27\u4f53\u68c0\uff08E2E_NO_AUDIT=1\uff09");
    return;
  }
  const portrait = params.height > params.width;
  console.log(
    "\n[e2e] \u9759\u5e27\u4f53\u68c0\uff08\u58a8\u8ff9 bbox / \u5185\u90e8\u7a7a\u6d1e / \u5bc6\u5ea6\uff09\u2026",
  );
  let warned = 0;
  for (let i = 0; i < storyboard.pages.length; i++) {
    const page = storyboard.pages[i];
    const png = path.join(outDir, `${params.theme}-${String(i + 1).padStart(2, "0")}-${page.layout}.png`);
    if (!existsSync(png)) {
      console.log(`  ? ${String(i + 1).padStart(2, "0")}-${page.layout} \u7f3a\u9759\u5e27`);
      continue;
    }
    const gray = await extractGray(png, null, params.width, params.height);
    if (!gray) continue;
    const geom = readBodyGeometry(path.join(outDir, `${String(i + 1).padStart(2, "0")}-${page.layout}.browser.log`));
    const bad = reportOne(
      `${String(i + 1).padStart(2, "0")}-${page.layout}/${page.art ?? "-"}`,
      measureInk(gray, params.width, params.height, { band: bodyBand(params.width, params.height) }),
      params.width,
      params.height,
      portrait,
      page.layout,
      geom,
    );
    if (bad) warned++;
  }
  console.log(`[e2e] \u9759\u5e27\u4f53\u68c0\u5b8c\u6210\uff1a${warned} \u9875\u6709\u544a\u8b66`);
};

/**
 * 成片体检：每页抽 30% / 60% / 85% 三个时点。
 *
 * 30% 是"前半程有没有缺内容"的检查点（入场绑字幕那批问题全在页内 30% 才显形）；
 * 85% 是"排好了的样子"。页边界按 DynamicVideo 的算法重算：有 sentences 用配音时长，
 * 否则用 durationSec，再扣掉转场重叠——不跟成片对齐的话，抽到的帧可能落在转场里。
 */
const auditMp4 = async (pages: TimedPage[], mp4: string) => {
  if (process.env.E2E_NO_AUDIT) return;
  const portrait = params.height > params.width;
  const TF = TRANSITION_FRAME_MAP as unknown as Record<string, number>;
  const durs = pages.map((p) =>
    p.sentences && p.sentences.length
      ? p.sentences.reduce((a: number, s: { seconds: number }) => a + Math.max(1, Math.round(s.seconds * FPS)), 0) +
        Math.round((p.sentenceGap || 0) * FPS) * Math.max(0, p.sentences.length - 1)
      : Math.round((p.durationSec || 4) * FPS),
  );
  const starts: number[] = [];
  let off = 0;
  pages.forEach((p, i) => {
    starts.push(off);
    const next = pages[i + 1];
    off += durs[i] - (next ? (TF[next.transition ?? "fade"] ?? 12) : 0);
  });

  console.log("\n[e2e] 成片体检（每页 40/52/64/76/88% 五个时点，取中位数）…");
  const band = bodyBand(params.width, params.height);
  let warned = 0;
  for (let i = 0; i < pages.length; i++) {
    const label = `${String(i + 1).padStart(2, "0")}-${pages[i].layout}/${pages[i].art ?? "-"}`;
    const samples: FrameMetrics[] = [];
    /*
     * 采样窗口从 30/60/85% 改成 40〜88% 五个点。
     *
     * 30% 那一点还在入场动画里：实测 chart 页（12s）t=36.6s 时墨迹一直延到 y=1639，
     * 与稳定态的 1478 差了 160px，于是同一页量出 89/71/71%，报了一条 20pp 的
     * 「可能有装饰或动画干扰」。延到 40% 之后就稳定在 71%；五点取中位数还能吃掉
     * 个别帧的装饰跳变（实测 75% 那一点跳到 77%，中位数仍是 71%）。
     */
    for (const frac of [0.4, 0.52, 0.64, 0.76, 0.88]) {
      const frame = starts[i] + Math.min(durs[i] - 2, Math.max(2, Math.round(durs[i] * frac)));
      const gray = await extractGray(mp4, frame / FPS, params.width, params.height);
      if (!gray) continue;
      samples.push(measureInk(gray, params.width, params.height, { band }));
    }
    if (!samples.length) continue;
    /*
     * 取五个采样点的中位数，而不是逐点报。
     *
     * 实测：背景装饰（右下角那排竖条、大色块）在某些帧里会碰到正文带边界——
     * chart 页第 1374 帧量出 71%，第 1370 帧却是 91%（ink 一直延到 x=1079、y=1690），那是装饰不是内容。
     * 单帧会误报，五点取中位数就稳；差异大时另外提一句，让人去看图。
     */
    const fills = samples.map((s) => s.fill).sort((a, b) => a - b);
    const median = fills[fills.length >> 1];
    // 中段离散度（见 robustSpread 的注释）：只问"这页整体稳不稳"，不被单帧装饰跳变拉大
    const spread = robustSpread(fills);
    const worstVoid = samples.reduce((best, s) => (s.voidPx > best.voidPx ? s : best), samples[0]);
    const m: FrameMetrics = { ...worstVoid, fill: median };
    if (spread > 8) {
      console.log(
        `  ! ${label} 五个采样点差异 ${spread}pp（${fills.map((f) => Math.round(f * 100)).join("/")}%），可能有装饰或动画干扰，请看图`,
      );
    }
    if (reportOne(label, m, params.width, params.height, portrait, pages[i].layout)) warned++;
  }
  console.log(`[e2e] 成片体检完成：${warned} 页有告警`);
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
  let stillFailed = 0;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const frame = starts[i] + Math.max(20, Math.round(((page.durationSec || 4) * FPS) / 2));
    const name = `${String(i + 1).padStart(2, "0")}-${page.layout}`;
    const outPng = path.join(outDir, `${params.theme}-${name}.png`);
    const configPath = path.join(outDir, `${name}.still.json`);
    /*
     * 浏览器日志：渲染端 BodyProbe 会把「标题底 / 正文顶底 / 字幕顶」以 TTT_BODY 报回来。
     * 这是唯一可靠的正文几何（像素口径看不见浅色卡片）。
     * 先删旧文件：日志是 append 写入，不删会把上一轮的结果当成这一轮的。
     */
    const browserLogPath = path.join(outDir, `${name}.browser.log`);
    rmSync(browserLogPath, { force: true });
    /*
     * 先删旧图。
     *
     * 不加这一步的话，渲染失败时体检会去量上一次跑留下的那张图——
     * 实测渲染全部失败（端口被占），体检照样打出 19% / 88% / 69% 这些数字，
     * 看上去像"这次的结果"，其实是一小时前的旧图。失败的页宁可在体检里显示"缺静帧"。
     */
    rmSync(outPng, { force: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        mode: "still",
        serveUrl,
        compositionId: "DynamicVideo",
        output: outPng,
        inputProps,
        frame,
        options: { gl: process.env.RENDER_GL || "swiftshader", browserLogPath },
      }),
    );
    const ts = Date.now();
    try {
      await runRender(configPath);
      console.log(`  ok ${name} (frame ${frame}, ${Date.now() - ts}ms)`);
    } catch (e) {
      stillFailed++;
      console.error(`  FAIL ${name}: ${(e as Error).message}`);
    } finally {
      rmSync(configPath, { force: true });
    }
  }
  if (stillFailed > 0) {
    console.error(`[e2e] ${stillFailed}/${pages.length} 页静帧渲染失败——体检会跳过这些页，别把缺的页当成"没问题"`);
  }
  console.log(`\n[e2e] 完成 -> ${outDir}`);
};

main().catch((e) => {
  console.error("[e2e] 失败：", e);
  process.exitCode = 1;
});
