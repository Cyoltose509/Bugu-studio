"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitProposal } from "@/app/admin/activities/actions";
import MentionEditor from "@/components/MentionEditor";

const initialState = { error: "", success: false };

function SubmitButton() {
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
          提交中...
        </>
      ) : (
        "提交申请"
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
      <input type="hidden" name="proposalType" value="SHARE" />

      {state.error && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{state.error}</p>
      )}

      {state.success ? (
        <p className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 font-medium">
          ✅ 申请已提交，等待管理员审核
        </p>
      ) : (
        <>
          <input
            name="title"
            placeholder="分享主题…"
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#D0DEE8" }}
          />
          <MentionEditor
            name="description"
            placeholder="简介（可选）"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#D0DEE8" }}
          />
          <SubmitButton />
        </>
      )}
    </form>
  );
}
