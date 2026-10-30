import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkPageCode, CODE_MAX_CHARS, LAYOUT_ANCHOR_MISSING } from "./codePage.js";

/**
 * 生成式版式的守门逻辑。
 * 这些用例的价值在于：任何一条被绕过，AI 写的代码就会带着宿主能力进渲染进程。
 *
 * 几何部分同样有硬约束：同一页横竖屏都要渲染，所以代码必须从 `band` / `portrait`
 * 算出位置（见 LAYOUT_ANCHOR_MISSING），只写横屏像素常量的页面会被整页拒绝。
 */
const GOOD = `
const Page = ({ page, band }) => {
  const f = remotion.useCurrentFrame();
  const o = remotion.interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: band.left,
        top: band.top,
        width: band.right - band.left,
        height: band.bottom - band.top,
        opacity: o,
        background: Kit.C.bg,
      }}
    >
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
      const Page = ({ band }) => (
        <div style={{ top: 10, width: band.right - band.left }} data-x={{ window: 1 }} />
      );
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

describe("原型链逃逸防护", () => {
  test("({}).constructor.constructor 这条老套绕过必须被拦", () => {
    const r = checkPageCode(`
      const Page = () => {
        const F = ({}).constructor.constructor;
        return <div>{F("return 1")()}</div>;
      };
      export default Page;
    `);
    assert.equal(r.ok, false, "应当拒绝原型链访问");
    assert.ok(
      r.problems.some((p) => p.includes("constructor")),
      r.problems.join(" / "),
    );
  });

  test("字符串下标形式同样拦截", () => {
    const r = checkPageCode(`
      const Page = () => <div>{(window)["constructor"]}</div>;
      export default Page;
    `);
    assert.equal(r.ok, false);
    assert.ok(
      r.problems.some((p) => p.includes("constructor")),
      r.problems.join(" / "),
    );
  });

  test("正常的点号链式调用不受影响", () => {
    const r = checkPageCode(`
      const Page = ({ page, band }) => (
        <div style={{ top: band.top }}>{page.title.trim().toUpperCase()}</div>
      );
      export default Page;
    `);
    assert.equal(r.ok, true, r.problems.join(" / "));
  });
});

/**
 * 版式锚点（band / portrait）是硬契约。
 *
 * 实测：模型写死横屏常量（top: 380 / left: 160），同一页在竖屏 1080×1920 上正文
 * 只占 884..1199，成片里就是一条漂在中间的窄带子。所以只要代码里既没解构/访问
 * `band` 也没提 `portrait`，就直接拒绝——拒绝后会重试，重试仍不合格才降级 points。
 */
describe("版式锚点：必须从 band 或 portrait 算位置", () => {
  test("解构 band 并用它定位：通过", () => {
    const r = checkPageCode(`
      const Page = ({ page, band }) => (
        <div style={{ position: "absolute", left: band.left, top: band.top, height: band.bottom - band.top }}>
          {page.title}
        </div>
      );
      export default Page;
    `);
    assert.equal(r.ok, true, r.problems.join(" / "));
  });

  test("按 portrait 分支：通过（不碰 band）", () => {
    const r = checkPageCode(`
      const Page = ({ page, portrait }) => (
        <div style={{ position: "absolute", left: portrait ? 64 : 160, top: portrait ? 240 : 150 }}>
          {page.title}
        </div>
      );
      export default Page;
    `);
    assert.equal(r.ok, true, r.problems.join(" / "));
  });

  test("不解构，直接 props.band 访问也算引用", () => {
    const r = checkPageCode(`
      const Page = (props) => <div style={{ top: props.band.top }}>{props.page.title}</div>;
      export default Page;
    `);
    assert.equal(r.ok, true, r.problems.join(" / "));
  });

  test("横屏常量写死、band 与 portrait 都不提：拒绝并给出竖屏实测提示", () => {
    const r = checkPageCode(`
      const Page = ({ page }) => (
        <div style={{ position: "absolute", left: 160, top: 380, width: 1600 }}>{page.title}</div>
      );
      export default Page;
    `);
    assert.equal(r.ok, false);
    assert.ok(r.problems.includes(LAYOUT_ANCHOR_MISSING), `应报出版式锚点缺失：${r.problems.join(" / ")}`);
    // 提示必须点名失败模式，模型才知道下一轮怎么改
    assert.ok(LAYOUT_ANCHOR_MISSING.includes("1080×1920"), "提示要说明竖屏画布尺寸");
    assert.ok(LAYOUT_ANCHOR_MISSING.includes("884..1199"), "提示要给出实测的失败区间");
    assert.ok(LAYOUT_ANCHOR_MISSING.includes("(band.bottom - band.top) * 0.8"), "提示要给出竖向占比要求");
  });

  test("只在字符串/对象键里出现 band 不算引用（仍然拒绝）", () => {
    const r = checkPageCode(`
      const Page = ({ page }) => (
        <div data-band="band" style={{ position: "absolute", top: 380, band: 1 }}>{page.title}</div>
      );
      export default Page;
    `);
    assert.equal(r.ok, false);
    assert.ok(r.problems.includes(LAYOUT_ANCHOR_MISSING), r.problems.join(" / "));
  });

  test("只报一条，不因多处使用而重复堆积", () => {
    const r = checkPageCode(`
      const Page = ({ page }) => <div>{page.title}</div>;
      export default Page;
    `);
    assert.equal(r.problems.filter((p) => p === LAYOUT_ANCHOR_MISSING).length, 1, r.problems.join(" / "));
  });
});
