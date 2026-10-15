"use client";

import { useState } from "react";
import { deleteJamSubmission } from "@/lib/actions/submissions";
import { useLang } from "@/lib/i18n/LangProvider";

export default function DeleteSubmissionButton({
  activityId,
  teamName,
}: {
  activityId: string;
  teamName: string;
}) {
  const { t } = useLang();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t("submit.confirmDeleteSubmission", { team: teamName }))) {
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
      alert(t("submit.deleteFailed"));
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs px-3 py-1.5 rounded-lg border border-[#F5C6C6] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50 transition-colors text-[var(--ui-text-red)]"
    >
      {deleting ? t("works.delete.deleting") : t("submit.deleteSubmission")}
    </button>
  );
}
