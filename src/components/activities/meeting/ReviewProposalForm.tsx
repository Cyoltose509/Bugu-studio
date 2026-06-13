"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { reviewProposal } from "@/app/admin/activities/actions";

const initialState = { error: "", success: false };

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      name="action"
      value="APPROVED"
      type="submit"
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-brand-blue"
    >
      {pending ? "处理中..." : "通过"}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      name="action"
      value="REJECTED"
      type="submit"
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60 disabled:cursor-not-allowed border-red-500 text-red-500"
    >
      {pending ? "处理中..." : "拒绝"}
    </button>
  );
}

export default function ReviewProposalForm({
  proposalId,
  title,
  userName,
  createdAt,
  description,
}: {
  proposalId: string;
  title: string;
  userName: string;
  createdAt: string;
  description?: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      try {
        await reviewProposal(
          proposalId,
          formData.get("action") as any,
          (formData.get("adminNote") as string) || undefined,
        );
        // 审核成功后刷新
        router.refresh();
        return { error: "", success: true };
      } catch (e: any) {
        return { error: e.message || "操作失败", success: false };
      }
    },
    initialState,
  );

  // 成功后不再渲染表单
  if (state.success) return null;

  return (
    <form action={formAction} className="bg-card rounded-xl border border-[#FFF3E0] p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-brand-text-heading">{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">待审核</span>
          </div>
          <p className="text-xs mt-1 text-brand-text-secondary">by {userName} · {createdAt}</p>
          {description && <p className="text-sm mt-1 text-brand-text-body">{description}</p>}
        </div>
      </div>

      {state.error && (
        <p className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2 items-center">
        <ApproveButton />
        <RejectButton />
        <input
          name="adminNote"
          placeholder="审核意见（可选）"
          className="flex-1 min-w-[120px] rounded-lg border border-brand-border-subtle px-3 py-1.5 text-xs placeholder-gray-400"
        />
      </div>
    </form>
  );
}
