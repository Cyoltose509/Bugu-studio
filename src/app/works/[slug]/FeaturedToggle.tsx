"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toggleFeatured } from "@/app/admin/projects/actions";

interface FeaturedToggleProps {
  projectId: string;
  isFeatured: boolean;
}

export default function FeaturedToggle({ projectId, isFeatured: initial }: FeaturedToggleProps) {
  const { data: session } = useSession();
  const [isFeatured, setIsFeatured] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 仅 ADMIN 可见
  if (session?.user?.role !== "ADMIN") return null;

  async function handleToggle() {
    setSaving(true);
    setError("");
    try {
      await toggleFeatured(projectId, isFeatured);
      setIsFeatured(!isFeatured);
    } catch (e: any) {
      setError(e.message || "操作失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        title={isFeatured ? "取消精选" : "设为精选（最多3个）"}
        className={`text-sm px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
          isFeatured
            ? "border-[#E38043] bg-[#FFF8E1] hover:bg-[#FFECB3]"
            : "border-gray-300 bg-white hover:bg-gray-50"
        }`}
        style={{ color: isFeatured ? "#E38043" : "#AAA" }}
      >
        {saving ? "⏳" : isFeatured ? "★ 已精选" : "☆ 设为精选"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "#E38043" }}>{error}</span>
      )}
    </div>
  );
}
