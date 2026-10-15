"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteProposal } from "@/app/admin/activities/actions";
import { useLang } from "@/lib/i18n/LangProvider";

const initialState = { error: "", success: false };

function ConfirmDeleteButton() {
  const { t } = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs px-1.5 py-0.5 rounded text-white transition-colors disabled:opacity-60 bg-red-500"
    >
      {pending ? "..." : t("common.confirm")}
    </button>
  );
}

export default function DeleteProposalButton({ proposalId }: { proposalId: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, formAction] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await deleteProposal(formData);
      if (result && "error" in result) {
        return { error: result.error as string, success: false };
      }
      return { error: "", success: true };
    },
    initialState,
  );

  // 删除成功后刷新页面缓存
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (showConfirm) {
    return (
      <form action={formAction} className="inline-flex items-center gap-1 shrink-0">
        <input type="hidden" name="proposalId" value={proposalId} />
        <span className="text-xs text-red-500">{t("meeting.confirmDelete")}</span>
        <ConfirmDeleteButton />
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors text-brand-text-secondary"
        >
          {t("common.cancel")}
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0 text-red-500"
      title={t("meeting.deleteAgendaItem")}
    >
      ✕
    </button>
  );
}
