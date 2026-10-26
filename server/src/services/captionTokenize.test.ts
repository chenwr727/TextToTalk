import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { CaptionToken } from "../../render/src/shared/render/tokenize.js";
import * as tokenizeModule from "../../render/src/shared/render/tokenize.js";

// server/render 子工程没有 "type": "module"，其下的 .ts 会被 tsx 当 CJS 编译：
// 具名导入拿不到（命名空间里只有 default / module.exports），真正的导出挂在 default 上。
const { tokenizeCaption } = (
  tokenizeModule as unknown as {
    default: { tokenizeCaption: (text: string) => CaptionToken[] };
  }
).default;

/**
 * karaoke 字幕的分词规则。看着琐碎，但每一个错了都会在成片里看得见：
 * 数字被拆开 -> "1"、"2"、".8%" 分三次变色；标点没并入 -> 行首逗号单独亮一下。
 */
describe("字幕分词（karaoke 高亮粒度）", () => {
  test("中文按字切分", () => {
    const t = tokenizeCaption("热失控");
    assert.deepEqual(
      t.map((x) => x.text),
      ["热", "失", "控"],
    );
    assert.equal(
      t.every((x) => !x.num),
      true,
    );
  });

  test("英文与数字按词切分，不拆开小数与单位", () => {
    const t = tokenizeCaption("约 12.8% 的 3 倍");
    const words = t.map((x) => x.text);
    // 空格会并入前一个 token，所以按 trim 后比较
    assert.ok(
      words.some((w) => w.trim() === "12.8%"),
      `实际切分：${JSON.stringify(words)}`,
    );
    assert.ok(
      words.some((w) => w.trim() === "3"),
      `实际切分：${JSON.stringify(words)}`,
    );
    assert.deepEqual(
      t.filter((x) => x.num).map((x) => x.text.trim()),
      ["12.8%", "3"],
    );
  });

  test("标点并入前一个 token，不产生单独变色的标点", () => {
    const t = tokenizeCaption("隔膜一破，温升陡增。");
    const texts = t.map((x) => x.text);
    assert.ok(texts.includes("破，"), `实际切分：${JSON.stringify(texts)}`);
    assert.ok(texts.includes("增。"), `实际切分：${JSON.stringify(texts)}`);
  });

  test("标点出现在句首时不会被丢弃", () => {
    const t = tokenizeCaption("。开头就是句号");
    assert.equal(t[0].text, "。");
    assert.equal(t.length, 7);
  });

  test("空串不炸，句尾空格不单独成段", () => {
    assert.deepEqual(tokenizeCaption(""), []);
    const t = tokenizeCaption("结束 ");
    assert.equal(
      t.some((x) => x.text.trim() === ""),
      false,
    );
  });

  test("数字判定覆盖千分位与倍数写法", () => {
    const nums = tokenizeCaption("1,200 元，4x 提速")
      .filter((x) => x.num)
      .map((x) => x.text);
    assert.ok(
      nums.some((n) => n.includes("1")),
      `实际识别：${JSON.stringify(nums)}`,
    );
    assert.ok(
      nums.some((n) => n.includes("4x")),
      `实际识别：${JSON.stringify(nums)}`,
    );
  });
});
