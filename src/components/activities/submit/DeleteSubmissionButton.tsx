"use client";

import { useState } from "react";
import { deleteJamSubmission } from "@/lib/actions/submissions";

export default function DeleteSubmissionButton({
  activityId,
  teamName,
}: {
  activityId: string;
  teamName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`确认删除队伍「${teamName}」的参赛作品？\n\n此操作不可撤销，删除后需要重新提交。`)) {
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteJamSubmission(activityId);
      if (result?.error) {
        alert(result.error);
        setDeleting(false);
      }
      // 成功时 revalidatePath 会触发页面刷新，不需要手动重置
    } catch {
      setDeleting(false);
      alert("删除失败，请重试");
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs px-3 py-1.5 rounded-lg border border-[#F5C6C6] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50 transition-colors text-[var(--ui-text-red)]"
    >
      {deleting ? "删除中..." : "删除作品"}
    </button>
  );
}
