"use client";

import { useTransition } from "react";
import { submitScore } from "../actions";

export function SubmitScoreForm({
  activityId,
  submissionId,
  myScore,
}: {
  activityId: string;
  submissionId: string;
  myScore: any;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitScore(activityId, formData);
    });
  }

  return (
    <details className="mt-2">
      <summary className="text-xs cursor-pointer list-none" style={{ color: myScore ? "#3388BB" : "#E38043" }}>
        {myScore ? "✏️ 修改评分" : "📝 打分"}
      </summary>
      <form action={handleSubmit} className="mt-3 space-y-3 p-3 rounded-lg" style={{ background: "#F8FAFB" }}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#777" }}>创意</label>
            <input name="creativity" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).creativity : ""}
              disabled={isPending}
              className="w-full rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#777" }}>执行</label>
            <input name="execution" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).execution : ""}
              disabled={isPending}
              className="w-full rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#777" }}>主题</label>
            <input name="theme" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).theme : ""}
              disabled={isPending}
              className="w-full rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#777" }}>整体</label>
            <input name="overall" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).overall : ""}
              disabled={isPending}
              className="w-full rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "#777" }}>评语（可选）</label>
          <textarea name="comment" rows={2} defaultValue={myScore?.comment || ""}
            disabled={isPending}
            className="w-full rounded-lg border px-3 py-1.5 text-sm resize-y disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
        </div>
        <button type="submit" disabled={isPending}
          className="text-xs px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: "#3388BB" }}>
          {isPending ? "提交中…" : "提交评分"}
        </button>
      </form>
    </details>
  );
}
