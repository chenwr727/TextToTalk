import { createContext, useContext } from "react";

/**
 * 手绘标注（effects.annotation）。
 *
 * 原本这个字段在 prompt 里对 AI 承诺了 highlight / underline / circle 三种手绘强调，
 * types、normalize 都有，但**渲染端从来没读过它** —— 又一个"AI 想表达却表达不出来"的开关。
 *
 * 标注要圈的是"本页最重要的那行字"，也就是页面标题。但标题由 21 个场景各自渲染，
 * 逐个传 prop 既啰嗦又容易漏。这里用上下文：PageBody 把本页的标注类型放进来，
 * PageHeading 自己消费，场景代码一行都不用改（和 accent 用 CSS 变量是同一个思路）。
 */
export type PageAnnotation = "highlight" | "underline" | "circle" | "none";

export const AnnotationContext = createContext<PageAnnotation | undefined>(undefined);

export const useAnnotation = (): PageAnnotation | undefined => useContext(AnnotationContext);
