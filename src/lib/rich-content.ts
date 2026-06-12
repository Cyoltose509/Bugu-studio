/**
 * 富文本解析工具
 * 支持 @成员提及 和 URL 链接自动识别
 * URL 支持三种格式：http(s):// 、www. 、裸域名（常见TLD）
 */

export interface TextSegment {
  type: "text" | "link" | "mention";
  content: string;    // 显示文本
  href?: string;       // 链接目标（link/mention 类型）
  raw?: string;        // @mention 原始文本（用于 DB 查找）
  needsProtocol?: boolean; // 需要补 https:// 协议
}

/** 常见 TLD 列表（与 MentionEditor 保持一致） */
const COMMON_TLDS = new Set([
  "com","org","net","io","dev","app","co","info","xyz","me","cc","tv","fm","be","to","nl","de","fr","uk","eu","ai","sh","ac","tw","hk","jp","kr","sg","in","au","nz","br","mx","ru","pl","it","es","pt","se","no","fi","dk","cz","ro","bg","hr","si","sk","lt","lv","ee","hu","gr","cy","mt","lu","at","ch","li","mc","ad","sm","va","tk","ws","am","az","ge","kg","kz","md","mn","th","tr","uz","vn","ph","id","my","pk","bd","lk","np","mm","kh","la","bn","tl","pg","fj","nc","pf","wf","yt","pm","bl","mf","gl","bq","cw","sx","aw","je","gg","im","tc","vi","pr","as","gu","mp","um","is","fo","sj","bv","hm","gs","tf","aq",
  "com.cn","net.cn","org.cn","gov.cn","edu.cn","co.uk","co.jp","co.kr","co.nz","ac.uk","ac.cn","ac.jp",
]);

/** 验证裸域名的 TLD */
function isValidTld(word: string): boolean {
  const lastDot = word.lastIndexOf(".");
  if (lastDot === -1) return false;
  const tld = word.slice(lastDot + 1).split(/[/?#]/)[0].toLowerCase();
  if (!/^[a-z]{2,6}$/.test(tld)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(word)) return false;
  return COMMON_TLDS.has(tld);
}

/** URL 截断字符集 */
const URL_STOP = `\\s<>"'，。！？、；：（）【】《》\u2018\u2019\u201c\u201d{}|\\\\^\`\\[\\]`;

/**
 * 将纯文本解析为结构化片段
 * - 识别 http(s):// 或 www. 开头的 URL
 * - 识别裸域名（仅常见 TLD）
 * - 识别 @xxx 格式的成员提及
 */
export function parseRichContent(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];

  // 步骤 1：匹配 http(s):// 或 www. 开头的 URL + @mention
  const pattern = new RegExp(
    `((?:https?:\\/\\/|www\\.)[^${URL_STOP}]+(?:\\/[^${URL_STOP}]*)?)|(@\\S+)`,
    "g"
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 收集 URL 位置（用于第 2 步排除）
  const urlSpans: Array<{ start: number; end: number }> = [];

  while ((match = pattern.exec(text)) !== null) {
    // 匹配前的纯文本
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // URL 链接
      const content = match[1];
      const needsProtocol = !content.startsWith("http");
      segments.push({
        type: "link",
        content,
        href: needsProtocol ? `https://${content}` : content,
        needsProtocol,
      });
      urlSpans.push({ start: match.index, end: pattern.lastIndex });
    } else if (match[2]) {
      // @mention
      const raw = match[2];
      segments.push({
        type: "mention",
        content: raw,
        raw,
      });
    }

    lastIndex = pattern.lastIndex;
  }

  // 剩余文本中查找裸域名
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    const bareSegments = extractBareDomains(remaining, lastIndex, urlSpans);
    segments.push(...bareSegments);
  } else {
    // 没有剩余，但可能在前面的纯文本段中也有裸域名
    const enriched: TextSegment[] = [];
    for (const seg of segments) {
      if (seg.type === "text") {
        const bareSegs = extractBareDomains(seg.content, -1, []);
        enriched.push(...bareSegs);
      } else {
        enriched.push(seg);
      }
    }
    // 替换原数组
    segments.length = 0;
    segments.push(...enriched);
  }

  // 合并相邻纯文本
  return mergeTextSegments(segments);
}

/** 从文本中提取裸域名，返回片段数组 */
function extractBareDomains(
  text: string,
  offset: number,
  existingUrlSpans: Array<{ start: number; end: number }>
): TextSegment[] {
  const segments: TextSegment[] = [];
  const bareRe = new RegExp(
    `(?<![.@\\/])([a-zA-Z0-9][-a-zA-Z0-9]*\\.[a-zA-Z]{2,6})`,
    "g"
  );

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  bareRe.lastIndex = 0;

  while ((m = bareRe.exec(text)) !== null) {
    const word = m[1];
    if (!isValidTld(word)) continue;

    const absStart = offset >= 0 ? offset + m.index : m.index;
    const absEnd = absStart + word.length;

    // 不与已有 URL 重叠
    const overlap = existingUrlSpans.some(u => absStart < u.end && absEnd > u.start);
    if (overlap) continue;

    if (m.index > lastIdx) {
      segments.push({ type: "text", content: text.slice(lastIdx, m.index) });
    }
    segments.push({
      type: "link",
      content: word,
      href: `https://${word}`,
      needsProtocol: true,
    });
    lastIdx = m.index + word.length;
  }

  if (lastIdx < text.length) {
    segments.push({ type: "text", content: text.slice(lastIdx) });
  }

  return segments;
}

/** 合并相邻的纯文本段 */
function mergeTextSegments(segments: TextSegment[]): TextSegment[] {
  const merged: TextSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === "text" && seg.type === "text") {
      last.content += seg.content;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * 解析 @mention 名称 — 提取 @ 后面的部分
 * 返回用于数据库查找的搜索词
 */
export function extractMentionName(raw: string): string {
  return raw.replace(/^@/, "").replace(/[,，。.!！?？;；:：、)]+$/, "").trim();
}
