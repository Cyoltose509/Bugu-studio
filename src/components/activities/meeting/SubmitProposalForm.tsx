"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitProposal } from "@/app/admin/activities/actions";
import { useLang } from "@/lib/i18n/LangProvider";
import MentionEditor from "@/components/ui/MentionEditor";

const initialState = { error: "", success: false };

function SubmitButton() {
  const { t } = useLang();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary text-sm px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
    >
      {pending ? (
        <>
          <Spinner />
          {t("form.submitting")}
        </>
      ) : (
        t("meeting.submitProposal")
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SubmitProposalForm({ activityId }: { activityId: string }) {
  const { t } = useLang();
  const [proposalType, setProposalType] = useState<"SHARE" | "SHOWCASE" | null>(null);
  const [state, formAction] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await submitProposal(formData);
      if (result && "error" in result) {
        return { error: result.error as string, success: false };
      }
      return { error: "", success: true };
    },
    initialState,
  );

  const chip = (active: boolean, kind: "SHARE" | "SHOWCASE") =>
    `text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
      active
        ? kind === "SHOWCASE" ? "agenda-chip-showcase" : "agenda-chip-share"
        : "text-brand-text-muted hover:text-brand-text-heading"
    }`;

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="activityId" value={activityId} />
      {proposalType ? <input type="hidden" name="proposalType" value={proposalType} /> : null}

      {state.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

      {state.success ? (
        <p className="text-xs font-medium text-green-700 dark:text-green-400">
          {t("meeting.proposalSubmitted")}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-brand-navy">{t("activityDetail.signUpShare")}</h3>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setProposalType("SHARE")} className={chip(proposalType === "SHARE", "SHARE")}>
                {t("activityDetail.proposalShare")}
              </button>
              <button type="button" onClick={() => setProposalType("SHOWCASE")} className={chip(proposalType === "SHOWCASE", "SHOWCASE")}>
                {t("activityDetail.proposalShowcase")}
              </button>
            </div>
          </div>
          {proposalType ? (
            <>
              <p className="text-[11px] leading-snug text-brand-text-muted">{t("activityDetail.proposalHint")}</p>
              <input
                name="title"
                placeholder={
                  proposalType === "SHOWCASE"
                    ? t("meeting.topicPlaceholderShowcase")
                    : t("meeting.topicPlaceholder")
                }
                required
                className="w-full bg-transparent py-1 text-sm font-medium text-brand-navy placeholder:text-brand-text-muted focus:outline-none"
              />
              <MentionEditor
                bare
                name="description"
                placeholder={t("meeting.descOptionalPlaceholder")}
                rows={2}
                className="border-t border-brand-border-subtle"
              />
              <SubmitButton />
            </>
          ) : null}
        </>
      )}
    </form>
  );
}
