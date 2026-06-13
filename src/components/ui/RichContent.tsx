import { prisma } from "@/lib/db/prisma";
import { parseRichContent, extractMentionName, type TextSegment } from "@/lib/rich-content";
import DOMPurify from "isomorphic-dompurify";

/**
 * 服务端组件：将纯文本渲染为富文本 HTML
 * 支持 @displayName(memberId) 新版格式 + @displayName 旧版格式
 */
export async function RichContent({ text }: { text: string }) {
  const segments = parseRichContent(text);

  const mentions = segments.filter((s) => s.type === "mention");
  const memberMap = new Map<string, string>();

  if (mentions.length > 0) {
    const memberIds: string[] = [];
    const displayNames: string[] = [];
    const idToRaw: Map<string, string[]> = new Map();

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

    if (memberIds.length > 0) {
      const membersById = await prisma.clubMember.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, displayName: true },
      });
      for (const m of membersById) {
        if (!m.displayName) continue;
        const raws = idToRaw.get(m.id) || [];
        for (const raw of raws) {
          memberMap.set(raw, `/members/${m.id}:${m.displayName}`);
        }
      }
    }

    if (displayNames.length > 0) {
      const membersByName = await prisma.clubMember.findMany({
        where: {
          displayName: { in: displayNames },
          ...(memberIds.length > 0 ? { id: { notIn: memberIds } } : {}),
        },
        select: { id: true, displayName: true },
      });
      for (const m of membersByName) {
        if (m.displayName) {
          memberMap.set(`@${m.displayName}`, `/members/${m.id}`);
        }
      }
    }
  }

  return (
    <span
      className="rich-content"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(segmentsToHtml(segments, memberMap), {
          ALLOWED_TAGS: ["a", "span", "br"],
          ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
        }),
      }}
    />
  );
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
  const SAFE_PROTOCOLS = ["http:", "https:", "mailto:"];
  return segments
    .map((seg) => {
      switch (seg.type) {
        case "link": {
          const rawHref = seg.href || seg.content;
          const safeHref = SAFE_PROTOCOLS.some((p) =>
            rawHref.toLowerCase().startsWith(p)
          )
            ? rawHref
            : "#blocked";
          const href = escAttr(safeHref);
          const text = esc(seg.content);
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="rich-link" style="color:#3388BB;text-decoration:underline;">${text}</a>`;
        }
        case "mention": {
          const rawKey = seg.raw || seg.content;
          const lookup = memberMap.get(rawKey);
          if (lookup) {
            const [idPart, currentName] = lookup.split(":");
            const displayText = currentName ? `@${currentName}` : seg.content;
            return `<a href="${escAttr(idPart)}" class="rich-mention" style="color:#3388BB;font-weight:500;text-decoration:none;border-bottom:1px dashed #3388BB;">${esc(displayText)}</a>`;
          }
          return `<span style="color:#E38043;font-weight:500">${esc(seg.content)}</span>`;
        }
        default:
          return esc(seg.content).replace(/\n/g, "<br/>");
      }
    })
    .join("");
}
