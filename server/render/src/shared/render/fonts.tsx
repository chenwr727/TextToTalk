import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * display 字体加载。
 *
 * 背景：标题/大字一直用系统字体栈（微软雅黑之类），这是"看起来像 PPT"最直接的原因之一。
 * 这里把 server/scripts/fetch-fonts.mjs 下到 public/fonts/ 的字体注册进来：
 * 思源黑体（Noto Sans SC）负责中文标题，Sora 负责拉丁字母与数字。
 *
 * 三条硬要求：
 * 1. **离线可用**：字体文件在仓库里，不依赖渲染时的外网。
 * 2. **缺了不崩**：manifest 或字体文件不存在时静默回退系统字体栈，绝不阻塞渲染。
 * 3. **确定性**：用 delayRender 等字体就绪再出帧，避免首帧抓到回退字体导致抖动。
 */

interface FaceFile {
  src: string;
  unicodeRange?: string;
}
interface FamilyEntry {
  alias: string;
  weight: number;
  files: FaceFile[];
}

let loading: Promise<void> | null = null;

const loadAll = (): Promise<void> =>
  (loading ??= (async () => {
    try {
      const res = await fetch(staticFile("fonts/manifest.json"));
      if (!res.ok) return;
      const data = (await res.json()) as { families?: FamilyEntry[] };
      const jobs: Promise<unknown>[] = [];
      for (const family of data.families ?? []) {
        for (const file of family.files ?? []) {
          const desc: FontFaceDescriptors = { weight: String(family.weight) };
          if (file.unicodeRange) desc.unicodeRange = file.unicodeRange;
          const face = new FontFace(family.alias, `url(${staticFile(`fonts/${file.src}`)}) format("woff2")`, desc);
          jobs.push(face.load().then((loaded) => void document.fonts.add(loaded)));
        }
      }
      await Promise.all(jobs);
    } catch {
      // 字体缺失/读取失败：保持系统字体栈，交给用户决定要不要跑 fetch-fonts
    }
  })());

/** 挂在合成根节点上，只负责等字体；web 缩略图那边走 shim，是空实现。 */
export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender("加载 display 字体"));
  useEffect(() => {
    loadAll().then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  }, [handle]);
  return null;
};
