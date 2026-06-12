/**
 * 富文本解析工具
 * 支持 @成员提及 和 URL 链接自动识别
 * URL 支持三种格式：http(s):// 、www. 、裸域名（常见TLD）
 *
 * @mention 两种格式（向后兼容）：
 *   新版: @displayName(memberId) — 内嵌成员ID，改名不受影响
 *   旧版: @displayName           — 纯文本，按名字查找
 */

export interface TextSegment {
  type: "text" | "link" | "mention";
  content: string;    // 显示文本
  href?: string;       // 链接目标（link/mention 类型）
  raw?: string;        // @mention 原始文本
  needsProtocol?: boolean; // 需要补 https:// 协议
  /** 新版格式携带的 memberId，用于精确查找（不受改名影响） */
  memberId?: string;
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
 * 新版 @mention 正则：@displayName(memberId)
 * memberId 为 clubMember.id (cuid格式如 cm_xxx)
 */
const NEW_MENTION_RE = /@([^(@\s]+)\(([a-zA-Z0-9_]+)\)/g;

/**
 * 将纯文本解析为结构化片段
 * - 识别 http(s):// 或 www. 开头的 URL
 * - 识别裸域名（仅常见 TLD）
 * - 识别新版 @displayName(memberId) 格式的成员提及 → 携带 memberId
 * - 识别旧版 @xxx 格式的成员提及（向后兼容）
 */
export function parseRichContent(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];

  // 步骤 1：匹配 http(s):// / www. 开头的 URL + 新旧 @mention
  const pattern = new RegExp(
    `((?:https?:\\/\\/|www\\.)[^${URL_STOP}]+(?:\\/[^${URL_STOP}]*)?)|(@[^(@\\s]+\\([a-zA-Z0-9_]+\\))|(@\\S+)`,
    "g"
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 收集 URL + mention 位置（用于后续排除重叠）
  const usedSpans: Array<{ start: number; end: number }> = [];

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
      usedSpans.push({ start: match.index, end: pattern.lastIndex });
    } else if (match[2]) {
      // 新版 @mention：@displayName(memberId)
      const full = match[2]; // e.g. "@吃药图书(cm_abc123)"
      const m2 = full.match(/^@([^(]+)\(([^)]+)\)$/);
      if (m2) {
        segments.push({
          type: "mention",
          content: `@${m2[1]}`,
          raw: `@${m2[1]}`,
          memberId: m2[2],
        });
      }
      usedSpans.push({ start: match.index, end: pattern.lastIndex });
    } else if (match[3]) {
      // 旧版 @mention：@displayName（纯文本，不含括号）
      const raw = match[3];
      // 确保不跟新版重叠
      const alreadyUsed = usedSpans.some(
        (s) => match!.index >= s.start && match!.index < s.end
      );
      if (!alreadyUsed) {
        segments.push({
          type: "mention",
          content: raw,
          raw,
        });
        usedSpans.push({ start: match.index, end: pattern.lastIndex });
      }
    }

    lastIndex = pattern.lastIndex;
  }

  // 剩余文本中查找裸域名
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    const bareSegments = extractBareDomains(remaining, lastIndex, usedSpans);
    segments.push(...bareSegments);
  } else {
    // 可能在前面的纯文本段中也有裸域名
    const enriched: TextSegment[] = [];
    for (const seg of segments) {
      if (seg.type === "text") {
        const bareSegs = extractBareDomains(seg.content, -1, []);
        enriched.push(...bareSegs);
      } else {
        enriched.push(seg);
      }
    }
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
  existingSpans: Array<{ start: number; end: number }>
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

    // 不与已有 match 重叠
    const overlap = existingSpans.some((u) => absStart < u.end && absEnd > u.start);
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
 * 解析 @mention 名称 — 提取 @ 后面的显示名部分
 * 新版格式 @displayName(memberId) → "displayName"
 * 旧版格式 @displayName → "displayName"
 */
export function extractMentionName(raw: string): string {
  // 先尝试新版格式
  const newMatch = raw.match(/^@?([^(]+)\([^)]+\)$/);
  if (newMatch) return newMatch[1].trim();

  // 旧版格式
  return raw.replace(/^@/, "").replace(/[,，。.!！?？;；:：、)]+$/, "").trim();
}

/**
 * 解析 @mention 获取 memberId（仅新版格式）
 * 返回 memberId 或 undefined
 */
export function extractMentionMemberId(raw: string): string | undefined {
  const m = raw.match(/@[^(]+\(([^)]+)\)$/);
  return m ? m[1] : undefined;
}
