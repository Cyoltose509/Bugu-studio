"use client";

import { useActionState, useState } from "react";
import { deleteCompetitionSubmission } from "../actions";

export default function DeleteSubmissionButton({ id, userName }: { id: string; userName: string | null }) {
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState(async () => {
    await deleteCompetitionSubmission(id);
  }, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded border transition-colors shrink-0"
        style={{ borderColor: "#EF4444", color: "#EF4444" }}
      >删除</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <h3 className="text-lg font-bold" style={{ color: "#25547A" }}>确认删除</h3>
            <p className="text-sm" style={{ color: "#555" }}>
              确定要删除「{userName || "未知用户"}」的作品提交吗？此操作不可撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#D0DEE8", color: "#555" }}
              >取消</button>
              <form action={formAction}>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
                  style={{ background: "#EF4444" }}
                >确认删除</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
