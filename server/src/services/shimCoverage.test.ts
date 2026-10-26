import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 「预览即成片」的实现方式是：前端把 remotion / @remotion/* 替换成 web/src/*-shim.ts 里的桩实现，
 * 然后直接 import 服务端真实的场景组件来渲染缩略图。
 *
 * 代价是：升级 Remotion 时如果新增了某个 API 而 shim 没跟上，**不会报错**——桩会静默返回常量，
 * 缩略图只是「画错了」。本测试就是为了把这种静默漂移变成红灯。
 *
 * 做法：从 web/src 出发做真实的 import 图遍历，凡是能走到的服务端渲染代码里，
 * 每一个 remotion / @remotion/* 的具名导入，都必须在对应 shim 里存在同名导出。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const WEB_SRC = path.join(REPO, "web", "src");
const RENDER_SRC = path.join(REPO, "server", "render", "src");

/** 包名 → 承载它的桩文件（相对 web/src） */
const SHIM_BY_MODULE: Record<string, string> = {
  remotion: "remotion-shim.ts",
  "@remotion/rough-notation": "rough-notation-shim.ts",
  "@remotion/paths": "paths-shim.ts",
  "@remotion/media-utils": "media-utils-shim.ts",
  "@remotion/layout-utils": "layout-utils-shim.ts",
  "@remotion/shapes": "shapes-shim.ts",
};

const isRemotionModule = (spec: string): boolean => spec === "remotion" || spec.startsWith("@remotion/");

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "gen") continue;
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** 把一条相对导入解析成真实文件（支持无扩展名、.js→.ts、目录 index） */
function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

interface ImportRecord {
  file: string;
  spec: string;
  /** 具名导入（含 type 导入）；默认导入记为 "default" */
  names: string[];
}

/** 解析文件里的 import 语句，抽出「模块 → 具名符号」 */
function parseImports(file: string): ImportRecord[] {
  const src = readFileSync(file, "utf8");
  const records: ImportRecord[] = [];
  const re = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const clause = m[1].trim();
    const spec = m[2];
    const names: string[] = [];

    const named = clause.match(/\{([\s\S]*?)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const name = part
          .replace(/^\s*type\s+/, "")
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) names.push(name);
      }
    }
    const star = clause.match(/\*\s+as\s+\w+/);
    if (star) names.push("*");
    const head = clause
      .split(",")[0]
      .replace(/\{[\s\S]*\}/, "")
      .trim();
    if (head && !head.startsWith("*") && !head.startsWith("{")) names.push("default");

    records.push({ file, spec, names });
  }
  return records;
}

/** 抽出 shim 文件对外暴露的标识符 */
function exportedNames(shimFile: string): Set<string> {
  const src = readFileSync(shimFile, "utf8");
  const names = new Set<string>();
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function|async\s+function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const alias = part.split(/\s+as\s+/).pop();
      const name = (alias ?? part).replace(/^\s*type\s+/, "").trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(src)) names.add("default");
  return names;
}

/** 从 web/src 出发遍历 import 图，收集所有能走到的 remotion 导入 */
function collectReachableRemotionImports(): { records: ImportRecord[]; visited: number } {
  const queue = listSourceFiles(WEB_SRC);
  const seen = new Set<string>(queue);
  const records: ImportRecord[] = [];

  while (queue.length) {
    const file = queue.pop() as string;
    for (const rec of parseImports(file)) {
      if (isRemotionModule(rec.spec)) {
        records.push(rec);
        continue;
      }
      if (!rec.spec.startsWith(".")) continue;
      const resolved = resolveImport(file, rec.spec);
      if (!resolved || seen.has(resolved)) continue;
      // 只跟进 web 自身与服务端渲染工程（共享代码），其它一律不深挖
      if (!resolved.startsWith(WEB_SRC) && !resolved.startsWith(RENDER_SRC)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return { records, visited: seen.size };
}

describe("web shim 与 Remotion 真实 API 的覆盖率", () => {
  const { records, visited } = collectReachableRemotionImports();

  test("import 图遍历确实走到了服务端渲染代码（防止测试因路径变化而空跑）", () => {
    assert.ok(visited > 10, `只遍历到 ${visited} 个文件，import 解析可能已失效`);
    assert.ok(records.length > 0, "没有在可达代码里找到任何 remotion 导入");
  });

  test("遍历到的 remotion 模块都有对应 shim 文件", () => {
    const missing = [...new Set(records.map((r) => r.spec))].filter((spec) => !(spec in SHIM_BY_MODULE));
    assert.deepEqual(missing, [], `以下模块被前端代码间接引用，但 web/src 下没有 shim：${missing.join(", ")}`);
  });

  test("每一个被导入的 remotion 符号都在 shim 中有同名导出", () => {
    const failures: string[] = [];
    for (const rec of records) {
      const shimName = SHIM_BY_MODULE[rec.spec];
      if (!shimName) continue;
      const shimFile = path.join(WEB_SRC, shimName);
      if (!existsSync(shimFile)) {
        failures.push(`${rec.spec} → 缺少 ${shimName}`);
        continue;
      }
      const available = exportedNames(shimFile);
      for (const name of rec.names) {
        if (!available.has(name)) {
          const rel = path.relative(REPO, rec.file).replace(/\\/g, "/");
          failures.push(`${rel} 导入的 ${rec.spec}.${name} 未在 ${shimName} 中导出`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  test("每个 shim 文件都登记在映射表里（不留孤儿桩）", () => {
    const shims = readdirSync(WEB_SRC).filter((f) => f.endsWith("-shim.ts"));
    const registered = new Set(Object.values(SHIM_BY_MODULE));
    const orphans = shims.filter((f) => !registered.has(f));
    assert.deepEqual(orphans, [], `web/src 下的 shim 未登记：${orphans.join(", ")}`);
  });
});
