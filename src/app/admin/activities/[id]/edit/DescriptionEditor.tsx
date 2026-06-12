"use client";

import MentionEditor from "@/components/MentionEditor";

export default function DescriptionEditor({ defaultValue }: { defaultValue: string }) {
  return (
    <MentionEditor
      name="description"
      defaultValue={defaultValue}
      rows={5}
      placeholder="活动详细说明"
      className="w-full rounded-lg border placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
      style={{ borderColor: "#D0DEE8", color: "#333" }}
    />
  );
}
