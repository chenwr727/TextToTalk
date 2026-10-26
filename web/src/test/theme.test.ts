import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEME_TOKENS,
  accentVars,
  normalizeThemeId,
  themeVars,
} from "../../../server/render/src/shared/render/theme";

const varsOf = (id: string) => themeVars(id) as unknown as Record<string, string>;
const keysOf = (id: string) => Object.keys(varsOf(id)).sort();

const luminance = (hex: string) => {
  const v = parseInt(hex.replace("#", ""), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

describe("主题 token", () => {
  it("未知主题回落到默认主题，而不是渲染成空白", () => {
    expect(normalizeThemeId("nope")).toBe(DEFAULT_THEME);
    expect(normalizeThemeId(null)).toBe(DEFAULT_THEME);
    expect(normalizeThemeId("dark")).toBe("dark");
  });

  it("tech 保持历史配色：默认主题不能悄悄变样", () => {
    const v = varsOf("tech");
    expect(v["--ttt-ink"]).toBe("#1c2536");
    expect(v["--ttt-accent"]).toBe("#3b6ff5");
    expect(v["--ttt-r-card"]).toBe("24px");
    expect(v["--ttt-font"]).toContain("Microsoft YaHei");
  });

  it("5 套主题注入同一组 CSS 变量（缺一个就会渲染成透明或纯黑）", () => {
    const base = keysOf(DEFAULT_THEME);
    expect(base.length).toBeGreaterThan(30);
    for (const id of THEME_IDS) {
      expect(keysOf(id)).toEqual(base);
    }
  });

  it("每套主题的 bg 覆盖全部页面变体", () => {
    for (const id of THEME_IDS) {
      for (const variant of ["title", "section", "chart", "art", "end", "default"]) {
        expect(THEME_TOKENS[id].bg[variant], `${id}/${variant}`).toBeTruthy();
      }
    }
  });

  it("主题之间字体 / 标题形态 / 圆角确实不同", () => {
    const fonts = new Set(THEME_IDS.map((id) => THEME_TOKENS[id].font));
    const headingStyles = new Set(THEME_IDS.map((id) => THEME_TOKENS[id].heading.style));
    const radii = new Set(THEME_IDS.map((id) => THEME_TOKENS[id].card.radius));
    expect(fonts.size).toBeGreaterThanOrEqual(3);
    expect(headingStyles.size).toBe(3);
    expect(radii.size).toBeGreaterThanOrEqual(3);
  });

  it("深色主题是浅字深卡，浅色主题是深字浅卡", () => {
    const dark = THEME_TOKENS.dark;
    const tech = THEME_TOKENS.tech;
    expect(dark.dark).toBe(true);
    expect(tech.dark).toBe(false);
    expect(luminance(dark.ink)).toBeGreaterThan(0.7);
    expect(luminance(tech.ink)).toBeLessThan(0.1);
    expect(dark.card.bg).toContain("rgba");
    expect(dark.card.radius).toBeGreaterThan(0);
  });

  it("主色的半透明档位引用 --ttt-accent，页面换主色时能跟着变", () => {
    const v = varsOf("warm");
    expect(v["--ttt-accent"]).toBe("#c2571b");
    expect(v["--ttt-accent-a80"]).toContain("color-mix");
    expect(v["--ttt-accent-a80"]).toContain("var(--ttt-accent)");
    expect(v["--ttt-grad-accent"]).toContain("var(--ttt-accent)");
    expect(v["--ttt-grad-accent"]).toContain("var(--ttt-grad-end)");
  });

  it("页面级主色通过旋转调色板变量实现，0 号不需要覆盖", () => {
    expect(accentVars(undefined)).toBeUndefined();
    expect(accentVars(null)).toBeUndefined();
    expect(accentVars(0)).toBeUndefined();
    const v = accentVars(2) as unknown as Record<string, string>;
    expect(v["--ttt-accent"]).toBe("var(--ttt-p2)");
    expect(v["--ttt-a0"]).toBe("var(--ttt-p2)");
    expect(v["--ttt-a5"]).toBe("var(--ttt-p1)");
    // 负数与越界也要能安全取模
    expect((accentVars(-1) as unknown as Record<string, string>)["--ttt-accent"]).toBe("var(--ttt-p5)");
    expect((accentVars(7) as unknown as Record<string, string>)["--ttt-accent"]).toBe("var(--ttt-p1)");
  });
});
