const URL_RE = /https?:\/\/[^\s]+/gi;
const MAX_URLS_PER_PROMPT = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function isUrl(input: string): boolean {
  return URL_RE.test(input.trim());
}

export function extractUrls(input: string): string[] {
  const urls = input.match(URL_RE) ?? [];
  return urls.map((u) => u.replace(/[),.;，。；]+$/, ""));
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchUrlContent(url: string): Promise<{ title: string; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TextToTalk/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`抓取失败：HTTP ${res.status}`);
    const contentLength = Number(res.headers.get("content-length") ?? "");
    if (contentLength > MAX_BODY_BYTES) throw new Error(`页面过大（>${Math.round(MAX_BODY_BYTES / 1024 / 1024)}MB），已跳过`);
    let html = "";
    const reader = res.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += Buffer.from(value).toString("utf-8");
      if (html.length > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error(`页面过大（>${Math.round(MAX_BODY_BYTES / 1024 / 1024)}MB），已跳过`);
      }
    }
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const text = extractText(html);
    if (!text) throw new Error("未能从该网址提取到正文内容");
    return { title, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchUrlContentWithBrowser(url: string): Promise<{ title: string; text: string }> {
  const { chromium } = await import("playwright-core");
  const { resolveChromiumPath } = await import("./chromium.js");
  const executablePath =
    process.env.CHROME_PATH ||
    process.env.REMOTION_BROWSER_EXECUTABLE ||
    (await resolveChromiumPath()) ||
    undefined;
  if (!executablePath) {
    throw new Error("未检测到 Chromium 内核（Edge / Chrome），无法抓取该网页。可设置 CHROME_PATH 指定浏览器路径。");
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});

    await page
      .waitForSelector("#js_content, article, .rich_media_content, body", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    const title = (await page.title()).trim();
    const text = await page.evaluate(() => {
      const root =
        document.querySelector("#js_content") ||
        document.querySelector(".rich_media_content") ||
        document.querySelector("article") ||
        document.body;
      const clone = root ? (root as HTMLElement).cloneNode(true) as HTMLElement : document.body;
      clone.querySelectorAll("script,style,noscript,svg").forEach((n) => n.remove());
      return (clone.textContent || "").replace(/\s+/g, " ").trim();
    });
    if (!text) throw new Error("浏览器渲染后仍未提取到正文内容");
    return { title, text };
  } finally {
    await browser.close();
  }
}

export async function resolvePrompt(input: string): Promise<{ prompt: string; fromUrl: boolean; urlTitle?: string }> {
  const trimmed = input.trim();
  const urls = extractUrls(trimmed).slice(0, MAX_URLS_PER_PROMPT);
  if (!urls.length) return { prompt: trimmed, fromUrl: false };

  const fetched: string[] = [];
  let firstTitle = "";
  for (const url of urls) {
    let title = "";
    let text = "";
    try {
      const r = await fetchUrlContent(url);
      title = r.title;
      text = r.text;
      if (text.length < 300) {
        const b = await fetchUrlContentWithBrowser(url);
        if (b.text.length > text.length) {
          title = b.title || title;
          text = b.text;
        }
      }
      if (!firstTitle) firstTitle = title;
      const body = text.length > 12000 ? text.slice(0, 12000) + "…" : text;
      fetched.push(`【网页标题】${title || "（无标题）"}\n【网页正文】\n${body}`);
    } catch (e) {
      try {
        const b = await fetchUrlContentWithBrowser(url);
        if (!firstTitle) firstTitle = b.title;
        const body = b.text.length > 12000 ? b.text.slice(0, 12000) + "…" : b.text;
        fetched.push(`【网页标题】${b.title || "（无标题）"}\n【网页正文】\n${body}`);
      } catch (e2) {
        fetched.push(`【网页 ${url}】抓取失败：${(e2 as Error).message}`);
      }
    }
  }

  const userText = trimmed.replace(URL_RE, "").trim();
  const parts: string[] = [];
  if (userText) parts.push(`【用户说明】\n${userText}`);
  parts.push(`【网页内容】\n${fetched.join("\n\n")}`);
  const prompt = `用户提供了一段说明和若干网页内容，请综合它们生成讲解视频大纲。\n\n${parts.join("\n\n")}`;
  return { prompt, fromUrl: true, urlTitle: firstTitle };
}