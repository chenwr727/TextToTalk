/**
 * 成片"墨迹审计"的纯计算部分。
 *
 * 起因：`quote` 页的大引号被绝对定位钉在 y≈280，而正文居中在 y≈900，中间 620px 全是空的。
 * 用"最上墨迹到最下墨迹"的填充率去量，这一页反而是 65%（比修好之后的 35% 还高）——
 * **bbox 只能证伪、不能证真**。真正能抓到它的是"bbox 内部最长的连续空白行"。
 *
 * 所以这里同时给出三个数：
 * - fill：墨迹 bbox 占画面高度的比例（有没有内容在页面上下半部）
 * - voidPx：bbox 内部最长连续空白行（页面中间有没有洞）
 * - inkRatio：bbox 内的墨迹密度（是不是只有稀疏几笔）
 * 三个都只是"信号"，最终仍然要人看图——它们负责把人叫过来。
 */

export interface FrameMetrics {
  /** 墨迹 bbox 覆盖画面高度的比例 0..1 */
  fill: number;
  /** bbox 内部最长连续空白行的像素数 */
  voidPx: number;
  /** 那段空白起始行 */
  voidAt: number;
  /** bbox 内的墨迹像素占比 0..1 */
  inkRatio: number;
  inkTop: number;
  inkBottom: number;
  inkLeft: number;
  inkRight: number;
  /** 「有结构」的第一行：墨迹行，或者出现明显竖边的行（卡片描边、色块边界） */
  structTop: number;
  /** 「有结构」的最后一行 */
  structBottom: number;
  /** 结构行之间最长连续空白行的像素数（卡片描边/浅色块也算结构，比 voidPx 准） */
  structVoidPx: number;
  /** 那段空白起始行 */
  structVoidAt: number;
}

export interface MeasureOptions {
  /**
   * 灰度差阈值：与行背景的中位数相差超过它才算墨迹。
   *
   * 默认 45 是量真片踩出来的：26 在 JPEG 上会把背景的大色块与渐变边缘算成墨迹——
   * 同一张 chart 帧，th26 量出 fill 100%（bbox 顶到正文带上下边界），
   * th45 才是真实的 71%。th45 / 60 / 90 对真实文字的结果几乎一致。
   */
  threshold?: number;
  /** 取左右各多少列估算背景色 */
  bgCols?: number;
  /**
   * 只量这一段（不含页标题与字幕条）。
   *
   * 实测教训：不裁带的话满屏都是"墨迹"——页面右下角那排装饰竖条一直画到 y=1895、
   * 页标题钉在 y≈90，于是填充率永远 95%，"空白"全落在字幕带里，指标彻底失效。
   */
  band?: { top: number; bottom: number };
  /**
   * 「结构边」的灰度差阈值：相邻两行同列相差超过它就算一条竖边。
   *
   * 背景是渐变 + 淡装饰环，实测同一行里超过这个差值的列数上限约 112（1920 宽），
   * 而一张卡的左右描边会占满 700+ 列，所以 10 足够把"卡片"和"背景装饰"分开。
   */
  structThreshold?: number;
  /** 一行里至少要有多少列出现结构边才算「有结构」；默认取内容宽度的 8% */
  structCols?: number;
}

/**
 * 正文带（页标题之下、字幕条之上）的近似边界。
 *
 * 数字对齐渲染端的版式常量：页标题固定在 y≈90..190，字幕条固定在底部 60dp 以上。
 * 竖屏 1080×1920 → 210..1690（实测成片里字幕条顶边就在 y≈1690）；
 * 横屏 1920×1080 → 200..920（字幕条在 y≈929..1020）。
 */
export function bodyBand(width: number, height: number): { top: number; bottom: number } {
  if (height > width) return { top: Math.round(height * 0.109), bottom: Math.round(height * 0.88) };
  return { top: Math.round(height * 0.185), bottom: Math.round(height * 0.852) };
}

const EMPTY: FrameMetrics = {
  fill: 0,
  voidPx: 0,
  voidAt: 0,
  inkRatio: 0,
  inkTop: 0,
  inkBottom: 0,
  inkLeft: 0,
  inkRight: 0,
  structTop: 0,
  structBottom: 0,
  structVoidPx: 0,
  structVoidAt: 0,
};

/** 中位数（会就地排序传入的数组副本） */
function median(values: number[]): number {
  const a = [...values].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * 从一张灰度图（每像素 1 字节、逐行排列）算出墨迹指标。
 *
 * 背景色按"每一行左右两侧像素的中位数"算，而不是全局一个颜色：竖屏成片的背景是
 * 竖向渐变（上浅下深），用全局背景会把整幅渐变都算成墨迹。
 */
export function measureInk(gray: Uint8Array, width: number, height: number, opts: MeasureOptions = {}): FrameMetrics {
  const threshold = opts.threshold ?? 45;
  const bgCols = Math.max(1, opts.bgCols ?? 10);
  const top = Math.max(0, Math.round(opts.band?.top ?? 0));
  const bottom = Math.min(height - 1, Math.round(opts.band?.bottom ?? height - 1));
  if (width <= 0 || height <= 0 || gray.length < width * height || bottom < top) return { ...EMPTY };

  const structThreshold = opts.structThreshold ?? 10;
  // 结构边只在中间这段列上数：两侧 6% 是页面装饰（右下的竖条、渐变边缘），不能算内容
  const marginX = Math.round(width * 0.06);
  const sx0 = marginX;
  const sx1 = Math.max(sx0, width - 1 - marginX);
  const structCols = Math.max(8, opts.structCols ?? Math.round((sx1 - sx0) * 0.09));

  const rowInk = new Uint8Array(height);
  const rowStruct = new Uint8Array(height);
  let inkTop = -1;
  let inkBottom = -1;
  let inkCount = 0;
  const colSeen = new Uint8Array(width);
  let inkLeft = -1;
  let inkRight = -1;

  for (let y = top; y <= bottom; y++) {
    const rowStart = y * width;
    const edges: number[] = [];
    for (let x = 0; x < bgCols && x < width; x++) edges.push(gray[rowStart + x]);
    for (let x = Math.max(0, width - bgCols); x < width; x++) edges.push(gray[rowStart + x]);
    const bg = median(edges);

    for (let x = 0; x < width; x++) {
      if (Math.abs(gray[rowStart + x] - bg) > threshold) {
        rowInk[y] = 1;
        colSeen[x] = 1;
        inkCount++;
      }
    }
    if (rowInk[y]) {
      if (inkTop < 0) inkTop = y;
      inkBottom = y;
    }

    /*
     * 结构行 = 有墨迹的行，或者「和上一行比，有一段明显的竖向台阶」的行。
     *
     * 后者专治浅色卡片：卡面是 #fff、背景是 #f5f6fa，灰度差只有 2~6，墨迹阈值 45 根本看不见，
     * 于是一页卡片顶在 y=250、卡内文字在 y=410 的版面会被记成 201px 空洞（实测 points 样例）。
     * 卡片的左右描边会在同一行上产生上千列的台阶，而背景装饰环最多百来列，所以数"台阶列数"够用。
     */
    if (y > top) {
      const prevStart = rowStart - width;
      let steps = 0;
      for (let x = sx0; x <= sx1; x++) {
        if (Math.abs(gray[rowStart + x] - gray[prevStart + x]) >= structThreshold) steps++;
      }
      if (steps >= structCols) rowStruct[y] = 1;
    }
    if (rowInk[y]) rowStruct[y] = 1;
  }
  if (inkTop < 0) return { ...EMPTY };

  for (let x = 0; x < width; x++) {
    if (colSeen[x]) {
      if (inkLeft < 0) inkLeft = x;
      inkRight = x;
    }
  }

  let voidPx = 0;
  let voidAt = 0;
  let run = 0;
  for (let y = inkTop; y <= inkBottom; y++) {
    if (rowInk[y]) {
      run = 0;
    } else {
      run++;
      if (run > voidPx) {
        voidPx = run;
        voidAt = y - run + 1;
      }
    }
  }

  // 结构口径：从第一行结构到最后一行的范围内，找最长的连续空行段
  let structTop = -1;
  let structBottom = -1;
  for (let y = top; y <= bottom; y++) {
    if (rowStruct[y]) {
      if (structTop < 0) structTop = y;
      structBottom = y;
    }
  }
  let structVoidPx = 0;
  let structVoidAt = 0;
  if (structTop >= 0) {
    let run2 = 0;
    for (let y = structTop; y <= structBottom; y++) {
      if (rowStruct[y]) {
        run2 = 0;
      } else {
        run2++;
        if (run2 > structVoidPx) {
          structVoidPx = run2;
          structVoidAt = y - run2 + 1;
        }
      }
    }
  }

  const bboxH = inkBottom - inkTop + 1;
  const bandH = bottom - top + 1;
  return {
    fill: bboxH / bandH,
    voidPx,
    voidAt,
    inkRatio: inkCount / (bboxH * width),
    inkTop,
    inkBottom,
    inkLeft,
    inkRight,
    structTop,
    structBottom,
    structVoidPx,
    structVoidAt,
  };
}

/**
 * 多个采样点的离散度（百分点），中段口径。
 *
 * 为什么不用 max-min：五个采样点里只要有一个撞上装饰动画的跳变，
 * 极差就被它一个人拉大——而那个跳变与内容多少无关。
 * 丢掉最大最小只看中段，问的是“这页整体稳不稳”。少于五个点时退回极差。
 */
export function robustSpread(fills: number[]): number {
  if (fills.length < 2) return 0;
  const a = [...fills].sort((x, y) => x - y);
  if (a.length >= 5) return Math.round((a[a.length - 2] - a[1]) * 100);
  return Math.round((a[a.length - 1] - a[0]) * 100);
}

export interface AuditVerdict {
  level: "warn" | "info";
  message: string;
}

/**
 * "天生稀疏"的版式：封面 / 章节页 / 收尾页。
 *
 * 这三页只有标题或一句结论，留白是设计的一部分，不该被"内容只占正文带 24%"反复提醒——
 * 上一轮刚把封面的标题放大到一行能放下的最大值，体检却还在对着它喊稀疏，
 * 下一个人看到就会继续改，改到把留白填满为止。
 *
 * 所以对这几页换一套判据：
 * - 填充率下限 15%（而不是 30%）：低于 15% 才说明这页根本没渲染出东西
 * - 内部空洞上限 25%（而不是 15%）：标题与要点之间天然有大段空白
 * - 不做横向占用检查：章节页的大号序号本来只占中间一小块
 */
export const AIRY_LAYOUTS: ReadonlySet<string> = new Set(["title", "section", "end"]);

/** 这类版式在填充率低于它时仍要报警（说明不是"设计留白"而是"没渲染出来"） */
const AIRY_MIN_FILL = 0.15;
/** 这类版式的内部空洞上限 */
const AIRY_MAX_VOID_RATIO = 0.25;

export interface VerdictOptions {
  band?: { top: number; bottom: number };
  /** 版式名（`title` / `points` / `chart` …），用来放宽天生稀疏的页面 */
  layout?: string;
}

/**
 * 把指标翻成一句人话。
 *
 * 阈值都是这一轮"量真片"踩出来的：内部空洞 >15% 正文带高就能肉眼看出断层
 * （quote 页是 620px / 带高 1480 ≈ 42%），填充率 <30% 基本就是"半页没内容"，
 * 横向 <60% 则是"两边空得能塞下别的东西"。
 * 注意 fill 与 voidPx 都是相对「正文带」而不是整幅画面：页标题和字幕条不参与判断。
 */
export function auditVerdict(
  m: FrameMetrics,
  width: number,
  height: number,
  isPortrait: boolean,
  opts: VerdictOptions = {},
): AuditVerdict[] {
  const b = opts.band ?? bodyBand(width, height);
  const bandH = Math.max(1, b.bottom - b.top + 1);
  const airy = !!opts.layout && AIRY_LAYOUTS.has(opts.layout);
  const out: AuditVerdict[] = [];
  if (m.fill <= 0) {
    out.push({ level: "warn", message: "整帧没有可识别的墨迹（黑屏/空白页？）" });
    return out;
  }
  /*
   * 口径说明（重要，别急着改）：
   * 判据仍然用墨迹口径的 voidPx。「结构行」那套（structTop/structVoidPx）只作为诊断输出，
   * 因为它对**细浅描边**不可靠：`steps` 这类卡有彩色顶条，结构行能落在 y=249（真正的卡顶）；
   * 而 `points` 这类卡只有一圈 alpha 很低的描边，结构行要等到卡内图标/文字才出现（y≈388）。
   * 用它去报"标题下方空白"会把 points 这种已经顶在标题下的页面误报成 188px 空洞。
   * 想真正判断"卡片从哪开始"，得在渲染端把 DOM 几何报出来，而不是从像素反推。
   */
  const inVoid = m.voidPx;
  const inVoidAt = m.voidAt;
  const pct = (px: number) => Math.round((px / bandH) * 100);
  if (airy) {
    if (m.fill < AIRY_MIN_FILL) {
      out.push({
        level: "warn",
        message: `这页天生稀疏，但内容只占 ${Math.round(m.fill * 100)}%（不足 ${Math.round(AIRY_MIN_FILL * 100)}%），像是没渲染出来`,
      });
    }
    if (inVoid > bandH * AIRY_MAX_VOID_RATIO) {
      out.push({
        level: "warn",
        message: `页面内部有 ${inVoid}px 连续空白（从 y=${inVoidAt} 起，占正文带 ${pct(inVoid)}%）`,
      });
    }
    return out;
  }
  if (inVoid > bandH * 0.15) {
    out.push({
      level: "warn",
      message: `页面内部有 ${inVoid}px 连续空白（从 y=${inVoidAt} 起，占正文带 ${pct(inVoid)}%）`,
    });
  }
  if (m.structTop > 0) {
    const headGap = m.structTop - b.top;
    const bottomGap = b.bottom - m.structBottom;
    // 上空白远大于下空白 = 内容被往下压（标题与正文之间裂开）；上下差不多是刻意居中，不提示
    if (headGap > bandH * 0.15 && headGap > bottomGap * 1.5) {
      out.push({
        level: "info",
        message: `第一处可见结构在 y=${m.structTop}，标题下方空 ${headGap}px（占正文带 ${pct(headGap)}%）——这个数偏大不代表真错，细浅描边会让它偏晚`,
      });
    }
  }
  if (m.fill < 0.3) {
    out.push({ level: "info", message: `内容只占正文带 ${Math.round(m.fill * 100)}%，上下留白很大` });
  }
  const xFill = (m.inkRight - m.inkLeft + 1) / Math.max(1, width);
  if (isPortrait && xFill < 0.6) {
    out.push({ level: "info", message: `横向只用了 ${Math.round(xFill * 100)}%，两侧空` });
  }
  return out;
}
