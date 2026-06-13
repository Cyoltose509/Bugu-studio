"use client";

import MentionEditor from "@/components/ui/MentionEditor";

export default function DescriptionEditor({ defaultValue }: { defaultValue: string }) {
  return (
    <MentionEditor
      name="description"
      defaultValue={defaultValue}
      rows={5}
      placeholder="活动详细说明"
      className="w-full rounded-lg border border-brand-border-subtle text-brand-text-heading placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
    />
  );
}
