import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 颜色令牌在主题化之后全是 CSS 变量（`var(--ttt-a1)` 之类）。
 *
 * 过去场景里习惯用「颜色 + hex 后缀」拼透明度：`${accent}cc`、`${a}1a`。
 * 颜色变成变量后，这种写法得到的是 `var(--ttt-a1)cc`——**非法值**，浏览器会整条丢弃，
 * 表现为色块、描边、渐变莫名消失，而且不报错。主题化的第一阶段就曾因此让
 * 图表柱、要点卡片的淡色底悄悄变透明。这个测试把这种静默失效变成红灯。
 *
 * 正确写法：`alpha(color, pct)`（内部走 color-mix），或直接用主题给的命名档位
 * （C.accentSoft / C.accentTint / C.accentWash …）。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const ROOTS = [path.join(REPO, "server", "render", "src"), path.join(REPO, "web", "src")];

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "out" || entry.name === "gen") continue;
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** `${anything}` 紧跟两位 hex —— 只可能是在给颜色拼 alpha 后缀 */
const HEX_SUFFIX = /\$\{[A-Za-z_$][\w$.]*\}[0-9a-fA-F]{2}(?![0-9A-Za-z_$])/;

describe("主题色令牌用法", () => {
  test("不得用拼 hex 后缀的方式给颜色加透明度", () => {
    const files = ROOTS.flatMap(listSourceFiles);
    assert.ok(files.length > 20, `扫描到的源文件太少（${files.length}），检查路径解析`);

    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        // 注释里说明历史写法是允许的
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
        const hit = HEX_SUFFIX.exec(line);
        if (hit) offenders.push(`${path.relative(REPO, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }

    assert.deepEqual(
      offenders,
      [],
      `以下位置把颜色变量当 hex 拼了后缀，浏览器会丢弃整条声明：\n${offenders.join("\n")}\n改用 alpha(color, pct)`,
    );
  });

  test("场景里不再出现只用 rgba() 硬编码的主题色", () => {
    // 白/黑叠加光效属于设计常量，不算主题色；这里只抓带主题主色倾向的硬编码蓝紫
    const suspicious = /\brgba?\(\s*(59|91)\s*,/;
    const files = ROOTS.flatMap(listSourceFiles);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
        if (suspicious.test(line))
          offenders.push(`${path.relative(REPO, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(offenders, [], `以下位置仍硬编码主题色（应走 C.* / accentOf）：\n${offenders.join("\n")}`);
  });
});
