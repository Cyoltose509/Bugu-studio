"use client";

/**
 * RichContentClient — 客户端组件，渲染预生成的富文本 HTML
 * 配合服务端 renderRichContent / batchRenderRichContent 使用
 */
export function RichContentClient({ html }: { html: string }) {
  if (!html) return null;
  return (
    <span
      className="rich-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
