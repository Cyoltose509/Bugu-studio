"use client";

import { useActionState, useId, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { reviewProposal } from "@/app/admin/activities/actions";
import { useLang } from "@/lib/i18n/LangProvider";

const initialState = { error: "", success: false };

type ReviewAction = "APPROVED" | "REJECTED";

export default function ReviewProposalForm({
  proposalId,
  title,
  userName,
  createdAt,
  description,
  imageUrl,
}: {
  proposalId: string;
  title: string;
  userName: string;
  createdAt: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  const { t } = useLang();
  const router = useRouter();
  const noteId = useId();
  const notePanelId = useId();
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [submittedAction, setSubmittedAction] = useState<ReviewAction | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      try {
        const rawAction = formData.get("action");
        const action: ReviewAction = rawAction === "REJECTED" ? "REJECTED" : "APPROVED";
        const rawNote = formData.get("adminNote");
        const adminNote = typeof rawNote === "string" && rawNote ? rawNote : undefined;

        const result = await reviewProposal(proposalId, action, adminNote);
        if (result && "error" in result && result.error) {
          return { error: result.error, success: false };
        }
        // 审核成功后刷新
        router.refresh();
        return { error: "", success: true };
      } catch {
        return { error: t("works.approve.failed"), success: false };
      }
    },
    initialState,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    if (submitter?.name !== "action") return;
    setSubmittedAction(submitter.value === "REJECTED" ? "REJECTED" : "APPROVED");
  }

  function cancelRejection() {
    setIsRejecting(false);
    setNote("");
    setSubmittedAction(null);
  }

  // 成功后不再渲染表单
  if (state.success) return null;

  const approvePending = isPending && submittedAction === "APPROVED";
  const rejectPending = isPending && submittedAction === "REJECTED";
  const actionButtonClass =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-brand-border-subtle bg-card p-4"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1 break-words font-semibold text-brand-text-heading">
            {title}
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-300/15 dark:text-amber-200">
            {t("work.badge.PENDING")}
          </span>
        </div>
        <p className="mt-1 text-xs text-brand-text-secondary">
          {t("meeting.by")} {userName} · {createdAt}
        </p>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={t("meeting.proposalImageAlt")}
            className="mt-3 h-28 w-full rounded-lg object-cover"
          />
        )}
        {description && (
          <p className="mt-1 break-words text-sm text-brand-text-body">{description}</p>
        )}
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400"
        >
          {state.error}
        </p>
      )}

      {!isRejecting && <div className="flex flex-wrap items-center gap-2">
        <button
          name="action"
          value="APPROVED"
          type="submit"
          disabled={isPending}
          className={`${actionButtonClass} bg-brand-blue text-white`}
        >
          {approvePending ? t("common.processing") : t("common.approve")}
        </button>
        {!isRejecting && (
          <button
            type="button"
            onClick={() => setIsRejecting(true)}
            disabled={isPending}
            aria-expanded={isRejecting}
            aria-controls={notePanelId}
            className={`${actionButtonClass} border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10`}
          >
            {t("common.reject")}
          </button>
        )}
      </div>}

      {isRejecting && (
        <div
          id={notePanelId}
          className="space-y-2 rounded-lg border border-brand-border-subtle bg-brand-surface-page p-3"
        >
          <label
            htmlFor={noteId}
            className="block text-xs font-medium text-brand-text-secondary"
          >
            {t("meeting.reviewNotePlaceholder")}
          </label>
          <textarea
            id={noteId}
            name="adminNote"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("meeting.reviewNotePlaceholder")}
            disabled={isPending}
            className="h-24 w-full resize-none rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cancelRejection}
              disabled={isPending}
              className={`${actionButtonClass} border border-brand-border-subtle text-brand-text-body hover:bg-brand-surface`}
            >
              {t("common.cancel")}
            </button>
            <button
              name="action"
              value="REJECTED"
              type="submit"
              disabled={isPending}
              className={`${actionButtonClass} border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10`}
            >
              {rejectPending ? t("common.processing") : t("common.reject")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
