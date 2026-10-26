import ts from "typescript";

/**
 * 受约束的页级代码生成（layout = "code"）的守门人。
 *
 * 动机：枚举版式（13 种 layout + 5 种 art + 8 种图表）能给 AI 的表达空间就那么大，
 * 结构复杂、关系奇特的内容只能被硬塞进某个版式里，看起来"模板味"很重。
 * 这里放开一层：AI 直接写一页 React 组件，但**只能**用白名单能力（Kit + remotion 的纯函数），
 * 服务端做 AST 级校验 + 转译，任何一条不满足就整页降级回 points 版式。
 *
 * 与"让 AI 随便写代码"的区别：
 * 1. 禁 import / require / 动态 import：生成代码拿不到任何模块系统；
 * 2. 禁 eval / new Function：不能在沙箱里再开沙箱；
 * 3. 禁 window / document / fetch / localStorage：不碰宿主环境与外网；
 * 4. 禁 setTimeout / requestAnimationFrame / Date.now / Math.random：
 *    Remotion 逐帧渲染要求**同一帧永远得到同一画面**，非确定性动画会直接导致成片抖动；
 * 5. 只允许一个 default export，渲染端用 `new Function` 注入 React / Kit / remotion 三个参数执行。
 */

export const CODE_MAX_CHARS = 12_000;

export interface CodeCheckResult {
  ok: boolean;
  /** 通过校验后的纯 JS（已去类型、JSX 已转译），可直接注入执行 */
  js?: string;
  problems: string[];
}

/** 禁用标识符：命中即整页降级，不尝试修补 */
const BANNED_IDENTIFIERS = new Set([
  "window",
  "document",
  "globalThis",
  "self",
  "parent",
  "top",
  "fetch",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "process",
  "require",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "Date",
  "performance",
  "navigator",
  "alert",
]);

/** 这些父节点下的标识符是"名字"而不是"引用"，不该误杀（如 obj.window、{ Date: 1 }） */
const isNamePosition = (node: ts.Node): boolean => {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isVariableDeclaration(p) && p.name === node) return true;
  if (ts.isParameter(p) && p.name === node) return true;
  if (ts.isFunctionDeclaration(p) && p.name === node) return true;
  if (ts.isFunctionExpression(p) && p.name === node) return true;
  if (ts.isPropertyDeclaration(p) && p.name === node) return true;
  if (ts.isJsxAttribute(p) && p.name === node) return true;
  if (ts.isBindingElement(p) && p.name === node) return true;
  return false;
};

const hasDefaultExport = (source: ts.SourceFile): boolean => {
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isExportAssignment(node)) found = true;
    const mods = (node as ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers;
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/**
 * 校验并转译生成代码。返回的 js 若存在即可直接 `new Function("React","Kit","remotion","module","exports", js)`。
 */
export const checkPageCode = (source: string): CodeCheckResult => {
  const problems: string[] = [];
  const code = String(source ?? "").trim();
  if (!code) return { ok: false, problems: ["code 为空"] };
  if (code.length > CODE_MAX_CHARS) {
    return { ok: false, problems: [`code 过长（${code.length} > ${CODE_MAX_CHARS} 字符）`] };
  }

  const sourceFile = ts.createSourceFile("page.tsx", code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);

  // parseDiagnostics 是 TS 运行时字段，未公开在类型里
  const parseDiagnostics =
    (sourceFile as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  for (const d of parseDiagnostics) {
    problems.push(`语法错误：${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
  if (problems.length) return { ok: false, problems };

  if (!hasDefaultExport(sourceFile)) {
    problems.push("缺少 `export default`：必须导出一个 React 组件");
  }

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      problems.push("禁止 import：生成代码拿不到模块系统，请用参数里的 React / Kit / remotion");
      return;
    }
    if (node.kind === ts.SyntaxKind.ImportKeyword) {
      problems.push("禁止动态 import()");
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "Math" && node.name.text === "random") {
        problems.push("禁止 Math.random：逐帧渲染要求同一帧永远得到同一画面");
      }
    }
    if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.has(node.text) && !isNamePosition(node)) {
      problems.push(`禁止使用 ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const seen = new Set<string>();
  const unique = problems.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  if (unique.length) return { ok: false, problems: unique };

  const out = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });

  for (const d of out.diagnostics ?? []) {
    if (d.category === ts.DiagnosticCategory.Error) {
      unique.push(`转译失败：${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
    }
  }
  const js = out.outputText ?? "";
  // 双保险：转译产物里不应再出现 require（CommonJS 包装由渲染端提供）
  if (/\brequire\s*\(/.test(js)) unique.push("转译产物仍包含 require，已拒绝");
  if (unique.length) return { ok: false, problems: unique };
  if (!/exports\s*\.\s*default|module\s*\.\s*exports/.test(js)) {
    return { ok: false, problems: ["转译产物没有 default 导出"] };
  }

  return { ok: true, js, problems: [] };
};
