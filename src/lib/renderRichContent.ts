/**
 * 服务端富文本渲染工具
 * 批量处理文本 → HTML，支持 @mention + URL 链接
 *
 * @mention 渲染策略：
 *   1. 有 memberId → 按 ID 精确查找（不受改名影响），查找当前 displayName
 *   2. 无 memberId → 按 displayName 查找（旧版兼容）
 *   3. 找不到 → 显示存储时的 displayName，无链接
 *
 * 安全：所有用户内容经 HTML 实体转义；链接仅允许 http/https/mailto 协议
 */
import { prisma } from "@/lib/db/prisma";
import {
  parseRichContent,
  extractMentionName,
  type TextSegment,
} from "@/lib/rich-content";
import sanitizeHtml from "sanitize-html";

/** 链接允许的协议白名单 */
const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

/**
 * 单条文本渲染为 HTML（自动查询数据库解析 @mention）
 */
export async function renderRichContent(text: string | null): Promise<string> {
  if (!text) return "";
  const segments = parseRichContent(text);
  const html = segmentsToHtml(segments, await buildMemberMap(segments));
  return sanitizeHtml(html, {
    allowedTags: ["a", "span", "br"],
    allowedAttributes: {
      a: ["href", "target", "rel", "class", "style"],
      span: ["class", "style"],
    },
  });
}

/**
 * 批量预渲染 — 一次数据库查询解析所有 @mention
 * 返回 Map<原始文本, HTML>
 */
export async function batchRenderRichContent(
  texts: (string | null)[]
): Promise<Map<string, string>> {
  const valid = texts.filter((t): t is string => !!t);
  if (valid.length === 0) return new Map();

  const allSegments = valid.map((t) => parseRichContent(t));
  const memberMap = await buildMemberMapFromSegments(allSegments);

  const result = new Map<string, string>();
  for (let i = 0; i < valid.length; i++) {
    const html = segmentsToHtml(allSegments[i], memberMap);
    result.set(valid[i], sanitizeHtml(html, {
      allowedTags: ["a", "span", "br"],
      allowedAttributes: {
        a: ["href", "target", "rel", "class", "style"],
        span: ["class", "style"],
      },
    }));
  }
  return result;
}

// ── 内部工具 ──

async function buildMemberMap(
  segments: TextSegment[]
): Promise<Map<string, string>> {
  return buildMemberMapFromSegments([segments]);
}

/**
 * 从所有 segments 构建 member 查找表
 * 优先按 memberId 查找（新版），其次按 displayName（旧版兼容）
 * Map key: raw mention text → "/members/{id}"
 */
async function buildMemberMapFromSegments(
  allSegments: TextSegment[][]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const mentions = allSegments
    .flat()
    .filter((s) => s.type === "mention");

  if (mentions.length === 0) return map;

  // 收集 memberId（新版格式）和 displayName（旧版格式）
  const memberIds: string[] = [];
  const displayNames: string[] = [];
  const idToRaw: Map<string, string[]> = new Map(); // memberId → [raw1, raw2, ...]

  for (const seg of mentions) {
    if (seg.memberId) {
      memberIds.push(seg.memberId);
      const existing = idToRaw.get(seg.memberId) || [];
      existing.push(seg.raw || seg.content);
      idToRaw.set(seg.memberId, existing);
    } else {
      const name = extractMentionName(seg.raw || "");
      if (name) displayNames.push(name);
    }
  }

  // 按 memberId 批量查找
  if (memberIds.length > 0) {
    const membersById = await prisma.clubMember.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, displayName: true },
    });

    for (const m of membersById) {
      if (!m.displayName) continue;
      const raws = idToRaw.get(m.id) || [];
      for (const raw of raws) {
        map.set(raw, `/members/${m.id}:${m.displayName}`);
      }
    }
  }

  // 按 displayName 查找（仅未被 memberId 覆盖的）
  if (displayNames.length > 0) {
    const membersByName = await prisma.clubMember.findMany({
      where: {
        displayName: { in: displayNames },
        // 排除已通过 memberId 找到的
        ...(memberIds.length > 0 ? { id: { notIn: memberIds } } : {}),
      },
      select: { id: true, displayName: true },
    });

    for (const m of membersByName) {
      if (m.displayName) {
        map.set(`@${m.displayName}`, `/members/${m.id}`);
      }
    }
  }

  return map;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s: string): string {
  return esc(s).replace(/'/g, "&#39;");
}

function segmentsToHtml(
  segments: TextSegment[],
  memberMap: Map<string, string>
): string {
  return segments
    .map((seg) => {
      switch (seg.type) {
        case "link": {
          const rawHref = seg.href || seg.content;
          // 安全检查：仅允许安全协议
          const safeHref = ALLOWED_PROTOCOLS.some((p) =>
            rawHref.toLowerCase().startsWith(p)
          )
            ? rawHref
            : "#blocked";
          const href = escAttr(safeHref);
          const text = esc(seg.content);
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="rich-link" style="color:#3388BB;text-decoration:none;border-bottom:1px solid #3388BB;padding-bottom:1px;">${text}</a>`;
        }
        case "mention": {
          const rawKey = seg.raw || seg.content;
          const lookup = memberMap.get(rawKey);
          if (lookup) {
            // lookup 格式: "/members/{id}" 或 "/members/{id}:{currentName}"
            const [idPart, currentName] = lookup.split(":");
            const displayText = currentName ? `@${currentName}` : seg.content;
            return `<a href="${escAttr(idPart)}" class="rich-mention" style="color:#3388BB;font-weight:500;text-decoration:none;border-bottom:1px dashed #3388BB;">${esc(displayText)}</a>`;
          }
          // 未找到 → 显示存储时的 displayName，无链接
          return `<span style="color:#E38043;font-weight:500">${esc(seg.content)}</span>`;
        }
        default:
          return esc(seg.content).replace(/\n/g, "<br/>");
      }
    })
    .join("");
}
