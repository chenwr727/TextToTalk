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

  const rowInk = new Uint8Array(height);
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
  };
}

export interface AuditVerdict {
  level: "warn" | "info";
  message: string;
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
  band?: { top: number; bottom: number },
): AuditVerdict[] {
  const b = band ?? bodyBand(width, height);
  const bandH = Math.max(1, b.bottom - b.top + 1);
  const out: AuditVerdict[] = [];
  if (m.fill <= 0) {
    out.push({ level: "warn", message: "整帧没有可识别的墨迹（黑屏/空白页？）" });
    return out;
  }
  if (m.voidPx > bandH * 0.15) {
    out.push({
      level: "warn",
      message: `页面内部有 ${m.voidPx}px 连续空白（从 y=${m.voidAt} 起，占正文带 ${Math.round((m.voidPx / bandH) * 100)}%）`,
    });
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
