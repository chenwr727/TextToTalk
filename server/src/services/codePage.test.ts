import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkPageCode, CODE_MAX_CHARS } from "./codePage.js";

/**
 * 生成式版式的守门逻辑。
 * 这些用例的价值在于：任何一条被绕过，AI 写的代码就会带着宿主能力进渲染进程。
 */
const GOOD = `
const Page = ({ page }) => {
  const f = remotion.useCurrentFrame();
  const o = remotion.interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, background: Kit.C.bg }}>
      <Kit.Heading text={page.title} />
      <Kit.Stat value="80℃" label="起始温度" />
    </div>
  );
};
export default Page;
`;

describe("生成式页代码校验", () => {
  test("正常组件：通过并产出可执行的 JS", () => {
    const r = checkPageCode(GOOD);
    assert.equal(r.ok, true, r.problems.join(" / "));
    assert.ok(r.js && r.js.includes("exports.default"), "转译产物应带 default 导出");
    assert.ok(!r.js!.includes("<div"), "JSX 应已被转译掉");
  });

  test("缺少 default 导出直接拒绝", () => {
    const r = checkPageCode("const Page = () => null;");
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes("export default")));
  });

  test("禁止 import：拿不到模块系统", () => {
    const r = checkPageCode(`import React from "react";\nexport default () => null;`);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes("禁止 import")));
  });

  test("禁止动态 import()", () => {
    const r = checkPageCode(`const x = () => import("fs");\nexport default x;`);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes("动态 import")));
  });

  test("禁止非确定性 API：Math.random / Date / setTimeout", () => {
    const r = checkPageCode(`
      const Page = () => {
        const n = Math.random();
        const t = Date.now();
        setTimeout(() => {}, 10);
        return <div>{n + t}</div>;
      };
      export default Page;
    `);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes("Math.random")));
    assert.ok(r.problems.some((p) => p.includes("Date")));
    assert.ok(r.problems.some((p) => p.includes("setTimeout")));
  });

  test("禁止宿主环境：window / document / fetch / eval", () => {
    const r = checkPageCode(`
      const Page = () => {
        const w = window.innerWidth;
        document.title = "x";
        fetch("/api");
        eval("1");
        return <div>{w}</div>;
      };
      export default Page;
    `);
    assert.equal(r.ok, false);
    for (const banned of ["window", "document", "fetch", "eval"]) {
      assert.ok(
        r.problems.some((p) => p.includes(banned)),
        `应拦截 ${banned}：${r.problems.join(" / ")}`,
      );
    }
  });

  test("同名字段作为对象键/属性名时不应误杀", () => {
    const r = checkPageCode(`
      const Page = () => <div style={{ top: 10, width: 100 }} data-x={{ window: 1 }} />;
      export default Page;
    `);
    assert.equal(r.ok, true, r.problems.join(" / "));
  });

  test("超长代码拒绝（避免把整本书塞进渲染进程）", () => {
    const r = checkPageCode(`const a = "${"x".repeat(CODE_MAX_CHARS)}";\nexport default a;`);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes("过长")));
  });

  test("空字符串与语法错误分别报出可读原因", () => {
    assert.equal(checkPageCode("   ").ok, false);
    const bad = checkPageCode("export default () => {");
    assert.equal(bad.ok, false);
    assert.ok(
      bad.problems.some((p) => p.includes("语法错误")),
      bad.problems.join(" / "),
    );
  });
});
