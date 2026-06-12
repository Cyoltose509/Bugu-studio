/**
 * 服务端富文本渲染工具
 * 批量处理文本 → HTML，支持 @mention + URL 链接
 */
import { prisma } from "@/lib/db/prisma";
import {
  parseRichContent,
  extractMentionName,
  type TextSegment,
} from "@/lib/rich-content";

/**
 * 单条文本渲染为 HTML（自动查询数据库解析 @mention）
 */
export async function renderRichContent(text: string | null): Promise<string> {
  if (!text) return "";
  const segments = parseRichContent(text);
  return segmentsToHtml(segments, await buildMemberMap(segments));
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
  const allMentionNames = new Set(
    allSegments
      .flat()
      .filter((s) => s.type === "mention")
      .map((s) => extractMentionName(s.raw!))
  );

  const memberMap = await buildMemberMapFromNames([...allMentionNames]);

  const result = new Map<string, string>();
  for (let i = 0; i < valid.length; i++) {
    result.set(valid[i], segmentsToHtml(allSegments[i], memberMap));
  }
  return result;
}

// ── 内部工具 ──

async function buildMemberMap(
  segments: TextSegment[]
): Promise<Map<string, string>> {
  const names = segments
    .filter((s) => s.type === "mention")
    .map((s) => extractMentionName(s.raw!))
    .filter((n) => n.length > 0);
  return buildMemberMapFromNames(names);
}

async function buildMemberMapFromNames(
  names: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (names.length === 0) return map;

  const members = await prisma.clubMember.findMany({
    where: {
      displayName: { in: names },
    },
    select: { id: true, displayName: true },
  });

  for (const m of members) {
    if (m.displayName) map.set(m.displayName, `/members/${m.id}`);
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
          const href = escAttr(seg.href || seg.content);
          const text = esc(seg.content);
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="rich-link" style="color:#3388BB;text-decoration:underline;">${text}</a>`;
        }
        case "mention": {
          const name = extractMentionName(seg.raw || "");
          const href = memberMap.get(name);
          if (href) {
            return `<a href="${escAttr(href)}" class="rich-mention" style="color:#3388BB;font-weight:500;text-decoration:none;border-bottom:1px dashed #3388BB;">${esc(seg.content)}</a>`;
          }
          return esc(seg.content);
        }
        default:
          return esc(seg.content).replace(/\n/g, "<br/>");
      }
    })
    .join("");
}
