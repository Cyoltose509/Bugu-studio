import { prisma } from "@/lib/db/prisma";
import { parseRichContent, extractMentionName, type TextSegment } from "@/lib/rich-content";

/**
 * 服务端组件：将纯文本渲染为富文本 HTML
 * 支持 @成员名(displayName) → 可点击成员链接，URL → 可点击外部链接
 */
export async function RichContent({ text }: { text: string }) {
  const segments = parseRichContent(text);

  // 收集所有 mention 名称
  const mentionNames = segments
    .filter((s) => s.type === "mention")
    .map((s) => extractMentionName(s.raw!))
    .filter((n) => n.length > 0);

  // 批量查找 ClubMember（按 displayName）
  const memberMap = new Map<string, string>();
  if (mentionNames.length > 0) {
    const members = await prisma.clubMember.findMany({
      where: {
        displayName: { in: mentionNames },
      },
      select: { id: true, displayName: true },
    });

    for (const m of members) {
      if (m.displayName) memberMap.set(m.displayName, `/members/${m.id}`);
    }
  }

  return (
    <span
      className="rich-content"
      dangerouslySetInnerHTML={{
        __html: segmentsToHtml(segments, memberMap),
      }}
    />
  );
}

// ── HTML 转义 ──

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

// ── 片段 → HTML ──

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
