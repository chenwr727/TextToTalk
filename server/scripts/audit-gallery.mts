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
import { existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { measureInk, auditVerdict, bodyBand } from "../src/services/frameAudit.js";
import type { BodyGeometry } from "../render/src/shared/render/bodyGeometry";

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
  warns: string[];
}[] = [];
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort()) {
  const full = path.join(dir, file);
  const m = measureInk(gray(full), W, H, { band: bodyBand(W, H) });
  const name = file.replace(/\.png$/, "");
  // 版式名也要先去掉 .png：否则 "end.png" 不在 AIRY_LAYOUTS 里，封面/结尾页会被当成普通页去量
  const layout = name.replace(/-.*$/, "");
  const g = readGeom(path.join(dir, `${name}.browser.log`));
  const warns = auditVerdict(m, W, H, portrait, { layout, geometry: g })
    .filter((v) => v.level === "warn")
    .map((v) => v.message);
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
    warns,
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
  console.log(
    `${r.name.padEnd(24)} fill ${String(r.fill).padStart(3)}%  空洞 ${String(r.voidPx).padStart(4)}px@${String(r.voidAt).padStart(3)}  墨迹起 ${String(r.inkTop).padStart(3)}  密度 ${String(r.ink).padStart(2)}%  ${dom}  ${r.warns.length ? "✗ " + r.warns.join(" / ") : ""}`,
  );
}
const warned = rows.filter((r) => r.warns.length);
const noGeom = rows.filter((r) => r.bodyTop == null);
const noHead = rows.filter((r) => r.bodyTop != null && r.headGap == null);
console.log(`\n合计 ${rows.length} 页，${warned.length} 页有告警；${noGeom.length} 页没拿到 DOM 几何`);
if (noGeom.length) console.log(`  没几何：${noGeom.map((r) => r.name).join(", ")}`);
if (noHead.length) console.log(`  无标题（几何照可用）：${noHead.map((r) => r.name).join(", ")}`);
