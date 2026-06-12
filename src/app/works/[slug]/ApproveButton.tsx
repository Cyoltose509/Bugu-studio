"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { approveProject } from "./approveAction";

export default function ApproveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleApprove = useCallback(async () => {
    setLoading(true);
    try {
      await approveProject(projectId);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
      style={{ background: "#88C232", color: "#fff" }}
    >
      {loading ? "处理中..." : "✅ 通过审核"}
    </button>
  );
}
