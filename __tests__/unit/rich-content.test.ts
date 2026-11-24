import { describe, it, expect } from "vitest";
import { parseRichContent } from "@/lib/rich-content";

const plain = (input: string) =>
  parseRichContent(input)
    .map((s) => s.content)
    .join("");

describe("parseRichContent 换行符处理", () => {
  it("CRLF 归一为单个 \\n，不残留 \\r", () => {
    const out = plain("第一行\r\n第二行\r\n\r\n第三行");
    expect(out).toBe("第一行\n第二行\n\n第三行");
    expect(out).not.toContain("\r");
  });

  it("单独的 CR 也归一为 \\n", () => {
    expect(plain("a\rb")).toBe("a\nb");
  });

  it("归一后仍能识别链接与 @ 提及", () => {
    const segs = parseRichContent("详见\r\nhttps://bugoostudio.com\r\n@小苏(cm123abc)");
    expect(segs.some((s) => s.type === "link" && s.content.includes("bugoostudio"))).toBe(true);
    expect(segs.some((s) => s.type === "mention" && s.memberId === "cm123abc")).toBe(true);
  });
});
