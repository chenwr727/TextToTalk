/**
 * 字幕分词：决定 karaoke 高亮的"一次点亮多少"。
 *
 * 纯函数，不依赖 React / Remotion，便于单测（见 server/src/services/captionTokenize.test.ts）。
 *
 * 规则：
 * - 中文按字切（逐字点亮才跟得上口播节奏）；
 * - 英文、数字、百分号等连写内容按词切（"12.8%" 不能被拆成 4 段）；
 * - 标点与空白并入前一个 token —— 否则行首的逗号会单独变一次色，非常突兀。
 */
export interface CaptionToken {
  text: string;
  /** 该 token 含数字：点亮时用高亮色 + 加粗强调 */
  num: boolean;
}

const isWordChar = (ch: string): boolean => /[A-Za-z0-9@#%+./_-]/.test(ch);
const isTrailing = (ch: string): boolean => /[，。！？、；：,.!?;:"'）】」》\s]/.test(ch);

export const tokenizeCaption = (text: string): CaptionToken[] => {
  const out: CaptionToken[] = [];
  let word = "";
  const flush = () => {
    if (word) {
      out.push({ text: word, num: /\d/.test(word) });
      word = "";
    }
  };
  for (const ch of Array.from(text)) {
    if (isWordChar(ch)) {
      word += ch;
      continue;
    }
    flush();
    if (isTrailing(ch) && out.length) {
      out[out.length - 1] = { text: out[out.length - 1].text + ch, num: out[out.length - 1].num };
    } else {
      out.push({ text: ch, num: false });
    }
  }
  flush();
  return out;
};
