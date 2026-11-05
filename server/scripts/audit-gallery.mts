/**
 * gallery 静帧体检：像素口径 + 渲染端回传的 DOM 几何，合成一张表。
 *
 * 用法：node --import tsx scripts/audit-gallery.mts <目录> <portrait|landscape>
 *   例：node --import tsx scripts/audit-gallery.mts out/gallery/tech landscape
 *
 * DOM 几何来自 BodyProbe（渲染时写进 `<name>.browser.log` 的 `TTT_BODY` 行）。
 * 「标题底 → 正文顶」是布局真值：像素口径看不见浅色卡片，只有它能判断内容有没有跟着标题。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { measureInk, auditVerdict, bodyBand } from "../src/services/frameAudit.js";
import type { BodyGeometry } from "../render/src/shared/render/bodyGeometry";
import type { ElementGeometryPayload } from "../render/src/shared/render/elementGeometry";
import {
  auditElements,
  auditPresence,
  auditContent,
  auditNumbers,
  auditIcons,
  auditPairs,
  auditCaption,
  auditPrefix,
  auditOrder,
  measureTruncation,
} from "../src/services/elementAudit.js";

const FF = process.env.E2E_FFMPEG || "ffmpeg";
const dir = process.argv[2];
const portrait = (process.argv[3] || "landscape") === "portrait";
const [W, H] = portrait ? [1080, 1920] : [1920, 1080];

const gray = (input: string): Buffer => {
  const tmp = `out/tmp-gray-${Math.random().toString(36).slice(2)}.raw`;
  const r = spawnSync(FF, ["-v", "error", "-i", input, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", tmp], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  const buf = readFileSync(tmp);
  rmSync(tmp, { force: true });
  return buf;
};

/** 读同名 browser.log，取最后一条 TTT_ELEMENTS（元素级盒子） */
const readElements = (logPath: string): ElementGeometryPayload | null => {
  if (!existsSync(logPath)) return null;
  let last: ElementGeometryPayload | null = null;
  for (const line of readFileSync(logPath, "utf8").split("\n")) {
    const text = line.trim();
    if (!text) continue;
    let msg = text;
    try {
      const outer = JSON.parse(text) as { text?: string };
      if (typeof outer.text === "string") msg = outer.text;
    } catch {
      /* 非 JSON 行当纯文本 */
    }
    const at = msg.indexOf("TTT_ELEMENTS ");
    if (at < 0) continue;
    try {
      const g = JSON.parse(msg.slice(at + "TTT_ELEMENTS ".length)) as ElementGeometryPayload;
      if (!Array.isArray(g.boxes)) continue;
      last = g;
    } catch {
      /* 截断行跳过 */
    }
  }
  return last;
};

/** 读同名 browser.log，取最后一条 TTT_BODY（同帧多条时后者更新） */
const readGeom = (logPath: string): BodyGeometry | null => {
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
      /* 非 JSON 行当纯文本 */
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

const rows: {
  name: string;
  fill: number;
  voidPx: number;
  voidAt: number;
  inkTop: number;
  ink: number;
  headGap: number | null;
  bodyTop: number | null;
  bodyBottom: number | null;
  domFill: number | null;
  stale: boolean;
  warns: string[];
  /** 被截掉、观众看不到的字数（长文案截断） */
  cut: number;
}[] = [];
/*
 * 旧图检测：PNG 比渲染产物（bundle）还旧，说明这张图不是用当前代码渲的。
 *
 * 踩过的坑：`GALLERY_ONLY='points'` 只重渲要点页，地图 PNG 还是上一次
 * 对抗性检验（故意注入 bug）留下的旧图，审计于是报"地图 fill 51% / 元素缺失"——
 * 看着像新引入的回归，实际是读了一张过期图片。
 */
const bundleMark = (() => {
  try {
    const bdir = path.join(process.cwd(), "render", "out", "bundle");
    let newest = 0;
    for (const f of readdirSync(bdir, { recursive: true }) as string[]) {
      const p = path.join(bdir, f);
      try {
        const st = statSync(p);
        if (st.isFile()) newest = Math.max(newest, st.mtimeMs);
      } catch {
        /* 读不到的跳过 */
      }
    }
    return newest;
  } catch {
    return 0;
  }
})();
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort()) {
  const full = path.join(dir, file);
  const m = measureInk(gray(full), W, H, { band: bodyBand(W, H) });
  const name = file.replace(/\.png$/, "");
  // 版式名也要先去掉 .png：否则 "end.png" 不在 AIRY_LAYOUTS 里，封面/结尾页会被当成普通页去量
  const layout = name.replace(/-.*$/, "");
  const g = readGeom(path.join(dir, `${name}.browser.log`));
  const els = readElements(path.join(dir, `${name}.browser.log`));
  const band = bodyBand(W, H);
  const pixWarns = auditVerdict(m, W, H, portrait, { layout, geometry: g })
    .filter((v) => v.level === "warn")
    .map((v) => v.message);
  /*
   * 元素级判据单独一组：像素口径看不见“裁字 / 压扁 / 重叠”，
   * 两个真 bug（四象限胶囊盖大字、横屏地图卡片被压到 17px）都是只能靠看图发现的。
   */
  const elFindings = els
    ? [
        ...auditElements(els.boxes, {
          width: W,
          height: H,
          bandTop: band.top,
          bandBottom: band.bottom,
          captionTop: g?.captionTop ?? null,
        }),
        ...auditPresence(els.boxes, els.expect, name),
        ...auditContent(els.boxes, els.expectTexts),
        ...auditNumbers(els.boxes, els.expectNumbers),
        ...auditIcons(els.icons, els.expectIcons),
        ...auditPairs(els.boxes, els.expectPairs),
        ...auditCaption(els.captionText, els.expectCaptions),
        ...auditOrder(els.expectOrder, els.boxes),
        ...auditPrefix(
          els.expectLongTexts,
          els.boxes.filter((b) => b.text).map((b) => b.text ?? ""),
        ),
      ]
    : [];
  const elWarns = elFindings.filter((v) => v.level === "warn").map((v) => v.message);
  const staleWarns: string[] = [];
  let stale = false;
  try {
    if (bundleMark > 0 && statSync(full).mtimeMs + 1000 < bundleMark) {
      stale = true;
      staleWarns.push("图片比渲染产物旧：这张不是当前代码渲的，先重渲再看");
    }
  } catch {
    /* 读不到时间就跳过 */
  }
  const warns = [...pixWarns, ...elWarns, ...staleWarns];
  const bandH = band.bottom - band.top + 1;
  /*
   * DOM 填充率：正文盒子实际占了多少带高。
   *
   * `fill` 是"墨迹 bbox 高 / 带高"，白卡页（qa / table）只有文字算墨迹，
   * 于是 qa 报 56% 而它的 DOM 明明是 213..1690 满带。两个数一起看才不会被误导：
   * 版面是否铺满看 domFill，墨迹是否稀疏看 fill。
   */
  const domFill =
    g?.bodyTop != null && g?.bodyBottom != null ? Math.round(((g.bodyBottom - g.bodyTop + 1) / bandH) * 100) : null;
  rows.push({
    name,
    fill: Math.round(m.fill * 100),
    voidPx: m.voidPx,
    voidAt: m.voidAt,
    inkTop: m.inkTop,
    ink: Math.round(m.inkRatio * 100),
    headGap: g && g.headingBottom != null && g.bodyTop != null ? Math.round(g.bodyTop - g.headingBottom) : null,
    bodyTop: g?.bodyTop ?? null,
    bodyBottom: g?.bodyBottom ?? null,
    domFill,
    stale,
    warns,
    cut: els ? measureTruncation(els.expectLongTexts, els.boxes).hiddenChars : 0,
  });
}

rows.sort((a, b) => b.voidPx - a.voidPx);
const band = bodyBand(W, H);
const bandHeight = band.bottom - band.top + 1;
console.log(
  `正文带 y=${band.top}..${band.bottom}（${bandHeight}px），告警阈值 = 空洞 > ${Math.round(bandHeight * 0.15)}px\n`,
);
for (const r of rows) {
  /*
   * 两种情况要分开写：「没几何」和「几何有了但这页没标题」。
   * 之前两者都打 n/a，看着像探针失效，实际上 end/title/section 一直没标题而已。
   */
  const dom =
    r.bodyTop == null || r.bodyBottom == null
      ? "DOM 几何   n/a（探针没量到）"
      : r.headGap == null
        ? `DOM 无标题（正文 ${r.bodyTop}..${r.bodyBottom}）`
        : `DOM 间距 ${String(r.headGap).padStart(4)}px（正文 ${r.bodyTop}..${r.bodyBottom}）`;
  /*
   * 过期图片**不输出数字**，只说明它是旧的。
   *
   * 踩过两次：读了一张局部渲染留下的旧图，把 "section DOM 24%" 写进 CHANGELOG（真实 40%）、
   * 把注入 bug 的旧图当成新回归。数字一旦打出来就会被引用，所以过期页直接不给数字。
   */
  if (r.stale) {
    console.log(`${r.name.padEnd(24)} ── 这张图不是当前代码渲的，数字不可用 ──  ✗ ${r.warns.join(" / ")}`);
    continue;
  }
  console.log(
    `${r.name.padEnd(24)} fill ${String(r.fill).padStart(3)}%  DOM ${r.domFill == null ? " n/a" : String(r.domFill).padStart(3) + "%"}  空洞 ${String(r.voidPx).padStart(4)}px@${String(r.voidAt).padStart(3)}  墨迹起 ${String(r.inkTop).padStart(3)}  密度 ${String(r.ink).padStart(2)}%  ${dom}  ${r.warns.length ? "✗ " + r.warns.join(" / ") : ""}`,
  );
}
/*
 * 负向对照页：样本里**故意**存在的错误页，它们就是要报警的。
 *
 * 没有它们，判据可能写了但从没在真实页面上验证过（图标判据就是这样：
 * 之前一个带 page.icon 的样本都没有，判据从未触发）。
 *
 * 它们的告警计入“预期告警”，不污染基线；但如果它们**不**报警，说明判据坏了，要单独报。
 */
const NEGATIVE_CONTROLS = new Set(["points-icon-bogus"]);
const negRows = rows.filter((r) => NEGATIVE_CONTROLS.has(r.name));
const warned = rows.filter((r) => r.warns.length && !NEGATIVE_CONTROLS.has(r.name));
const negSilent = negRows.filter((r) => !r.warns.length);
/*
 * 被截掉的字：长文案截断是版面设计，不算错，但“有多少字观众看不到”
 * 以前没人知道。这里把它当事实报出来，不当告警。
 */
const cutRows = rows.filter((r) => r.cut > 0).sort((a, b) => b.cut - a.cut);
const noGeom = rows.filter((r) => r.bodyTop == null);
const noHead = rows.filter((r) => r.bodyTop != null && r.headGap == null);
console.log(`\n合计 ${rows.length} 页，${warned.length} 页有告警；${noGeom.length} 页没拿到 DOM 几何`);
if (negRows.length) {
  console.log(`  负向对照（故意错误页，告警是预期）：${negRows.map((r) => r.name).join(", ")}`);
  if (negSilent.length) {
    console.log(`  ⚠ 这些页**没报警**：${negSilent.map((r) => r.name).join(", ")}——判据可能坏了`);
  }
}
if (cutRows.length) {
  console.log(
    `  文案被截掉的字数（截断是版面设计，不算错，但这些字观众看不到）：` +
      cutRows.map((r) => `${r.name} ${r.cut} 字`).join("、"),
  );
}
if (noGeom.length) console.log(`  没几何：${noGeom.map((r) => r.name).join(", ")}`);
if (noHead.length) console.log(`  无标题（几何照可用）：${noHead.map((r) => r.name).join(", ")}`);
/*
 * 过期图片给出**可直接执行**的重渲命令，别让人对着"N 页过期"自己猜怎么修。
 * 局部渲染（GALLERY_ONLY / GALLERY_PAGES）是主要来源：只重渲挑中的页，其余保留旧图。
 *
 * `AUDIT_FIX=1` 时自动把那几页重渲掉，然后提示重跑审计——
 * 自动重渲只覆盖"过期"这一种情况，因为它是唯一能**确定该怎么修**的情况
 * （其余告警要靠人判断，不该让脚本自作主张改产物）。
 */
const staleRows = rows.filter((r) => r.stale);
if (staleRows.length) {
  const size = portrait ? "portrait" : "landscape";
  const dirName = portrait ? "tech-portrait" : "tech";
  const names = staleRows.map((r) => r.name);
  console.log(`\n⚠ ${names.length} 页图片比渲染产物旧（不是当前代码渲的）：${names.join(", ")}`);
  if (process.env.AUDIT_FIX === "1") {
    console.log(`  AUDIT_FIX=1：正在重渲这 ${names.length} 页…`);
    const r = spawnSync(process.execPath, [path.join("scripts", "gallery.mjs")], {
      stdio: "inherit",
      env: { ...process.env, GALLERY_SIZE: size, GALLERY_THEME: "tech", GALLERY_PAGES: names.join(",") },
    });
    if (r.status !== 0) {
      console.log(`  重渲失败（exit ${r.status}），请手动执行下面的命令`);
    } else {
      console.log(`  ✓ 已重渲。重跑审计看新数字：`);
      console.log(`    node --import tsx scripts\\audit-gallery.mts out\\gallery\\${dirName} ${size}`);
      process.exit(0);
    }
  }
  console.log(`  重渲：$env:GALLERY_SIZE='${size}'; node scripts\\gallery.mjs   （去掉 GALLERY_ONLY 才会渲全部）`);
  console.log(`  或只重渲这几页：$env:GALLERY_PAGES='${names.join(",")}'; node scripts\\gallery.mjs`);
  console.log(
    `  或加 AUDIT_FIX=1 自动重渲：$env:AUDIT_FIX='1'; node --import tsx scripts\\audit-gallery.mts out\\gallery\\${dirName} ${size}`,
  );
  console.log(`  再审计：node --import tsx scripts\\audit-gallery.mts out\\gallery\\${dirName} ${size}`);
}
