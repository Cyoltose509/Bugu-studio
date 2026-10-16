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
  const [proposalType, setProposalType] = useState<"SHARE" | "SHOWCASE">("SHARE");
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

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="proposalType" value={proposalType} />

      {state.error && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{state.error}</p>
      )}

      {state.success ? (
        <p className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 font-medium">
          {t("meeting.proposalSubmitted")}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProposalType("SHARE")}
              className={`flex-1 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                proposalType === "SHARE"
                  ? "border-brand-blue bg-[#E8F4FD] text-brand-blue"
                  : "border-brand-border-subtle text-brand-text-secondary"
              }`}
            >
              {t("activityDetail.proposalShare")}
            </button>
            <button
              type="button"
              onClick={() => setProposalType("SHOWCASE")}
              className={`flex-1 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                proposalType === "SHOWCASE"
                  ? "border-brand-orange bg-[#FFF3E0] text-brand-orange"
                  : "border-brand-border-subtle text-brand-text-secondary"
              }`}
            >
              {t("activityDetail.proposalShowcase")}
            </button>
          </div>
          <input
            name="title"
            placeholder={
              proposalType === "SHOWCASE"
                ? t("meeting.topicPlaceholderShowcase")
                : t("meeting.topicPlaceholder")
            }
            required
            className="w-full rounded-lg border border-brand-border-subtle px-3 py-2 text-sm"
          />
          <MentionEditor
            name="description"
            placeholder={t("meeting.descOptionalPlaceholder")}
            rows={2}
            className="w-full rounded-lg border border-brand-border-subtle px-3 py-2 text-sm"
          />
          <SubmitButton />
        </>
      )}
    </form>
  );
}
