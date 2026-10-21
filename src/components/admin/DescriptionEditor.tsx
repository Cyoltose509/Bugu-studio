"use client";

import MentionEditor from "@/components/ui/MentionEditor";

export default function DescriptionEditor({ defaultValue }: { defaultValue: string }) {
  return (
    <MentionEditor
      name="description"
      defaultValue={defaultValue}
      rows={8}
      placeholder="活动详细说明，支持 @成员 与链接高亮"
      className="w-full"
    />
  );
}
