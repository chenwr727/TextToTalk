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

/**
 * 版式锚点 prop：生成代码必须至少真实引用其中一个。
 *
 * 实测失败样本：模型按横屏写死 `top: 380` / `left: 160`，同一页投到竖屏 1080×1920 上
 * 正文只占 884..1199（正文带高 1481px，上下各空 800+ 像素），成片里就是一条漂在
 * 画面中间的窄带子。`band` 是渲染端已算好的正文目标盒子（已避开标题与字幕），
 * `portrait` 是方向标志——代码里出现过这两个名字，才有机会算出竖屏也成立的位置。
 */
const LAYOUT_ANCHOR_PROPS = new Set(["band", "portrait"]);

/** 既不用 band 也不用 portrait 时的拒绝原因（同时也是重试提示，会原样拼进 diagnostics） */
export const LAYOUT_ANCHOR_MISSING =
  "必须使用 `band` 或 `portrait`：同一页也会被渲染成竖屏 1080×1920，只写横屏像素常量（如 `top: 380` / `left: 160`）会让正文只剩 884..1199 一条窄带子（实测，正文带高 1481px，上下各空 800+ 像素）。请用 `band`（`{ top, bottom, left, right }`，已避开标题与字幕）算出位置，或按 `portrait` 分支；竖向至少占满 `(band.bottom - band.top) * 0.8`。";

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

  /** 本次遍历里出现过的版式锚点 prop（`band` / `portrait`） */
  const usedAnchors = new Set<string>();

  const visit = (node: ts.Node) => {
    /*
     * 版式锚点：只认 AST 里的真实引用——解构参数 `({ band })`、成员访问 `props.band`、
     * 字符串下标 `props["band"]`、以及裸标识符用法。字符串字面量、对象键、JSX 属性名
     * 这类"名字位置"不算：`<div data-band="x" />`、`{ band: 1 }` 都没有把 band 用起来。
     */
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && LAYOUT_ANCHOR_PROPS.has(node.name.text)) {
      usedAnchors.add(node.name.text);
    }
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      problems.push("禁止 import：生成代码拿不到模块系统，请用参数里的 React / Kit / remotion");
      return;
    }
    if (node.kind === ts.SyntaxKind.ImportKeyword) {
      problems.push("禁止动态 import()");
      return;
    }
    // 原型链逃逸：({}).constructor.constructor("...") 能绕过标识符黑名单拿到 Function，
    // 所以必须连属性名一起禁，而不是只禁 Function 这个标识符。
    const PROPERTY_BANNED = new Set(["constructor", "__proto__", "prototype"]);
    if (ts.isPropertyAccessExpression(node)) {
      if (LAYOUT_ANCHOR_PROPS.has(node.name.text)) usedAnchors.add(node.name.text);
      if (ts.isIdentifier(node.expression) && node.expression.text === "Math" && node.name.text === "random") {
        problems.push("禁止 Math.random：逐帧渲染要求同一帧永远得到同一画面");
      }
      if (PROPERTY_BANNED.has(node.name.text)) {
        problems.push(`禁止访问 .${node.name.text}：可经原型链拿到 Function 等宿主能力`);
      }
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      if (LAYOUT_ANCHOR_PROPS.has(node.argumentExpression.text)) usedAnchors.add(node.argumentExpression.text);
      if (PROPERTY_BANNED.has(node.argumentExpression.text)) {
        problems.push(`禁止访问 ["${node.argumentExpression.text}"]：可经原型链拿到 Function 等宿主能力`);
      }
    }
    if (ts.isIdentifier(node) && LAYOUT_ANCHOR_PROPS.has(node.text) && !isNamePosition(node)) {
      usedAnchors.add(node.text);
    }
    if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.has(node.text) && !isNamePosition(node)) {
      problems.push(`禁止使用 ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // 一条硬规则：一页代码必须能自己算出两个方向的位置，band 与 portrait 都不提就没得算
  if (!usedAnchors.size) problems.push(LAYOUT_ANCHOR_MISSING);

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
