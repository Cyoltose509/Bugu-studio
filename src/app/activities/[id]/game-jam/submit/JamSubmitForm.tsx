"use client";

import { useTransition } from "react";
import { submitJamWork } from "../actions";

export function JamSubmitForm({
  activityId,
  isOngoing,
  existing,
}: {
  activityId: string;
  isOngoing: boolean;
  existing: any;
}) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await submitJamWork(activityId, formData);
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-1" style={{ color: "#555" }}>作品标题 *</label>
        <input name="title" required defaultValue={existing?.title || ""} maxLength={100}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }}
          disabled={!isOngoing || isPending} />
      </div>

      <div>
        <label className="block text-sm mb-1" style={{ color: "#555" }}>作品描述</label>
        <textarea name="description" rows={4} defaultValue={existing?.description || ""}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y disabled:opacity-50" style={{ borderColor: "#D0DEE8" }}
          disabled={!isOngoing || isPending} />
      </div>

      <div>
        <label className="block text-sm mb-1" style={{ color: "#555" }}>关联作品链接（可选）</label>
        <input name="projectId" defaultValue={existing?.projectId || ""} placeholder="如：作品 ID" maxLength={200}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }}
          disabled={!isOngoing || isPending} />
      </div>

      <div>
        <label className="block text-sm mb-1" style={{ color: "#555" }}>截图/GIF链接（多个用逗号分隔）</label>
        <input name="fileUrls" defaultValue={existing?.files?.join(", ") || ""} placeholder="https://xxx.png, https://xxx.gif"
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }}
          disabled={!isOngoing || isPending} />
      </div>

      {isOngoing && (
        <button type="submit" disabled={isPending}
          className="text-sm px-6 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "#25547A" }}>
          {isPending ? "提交中…" : existing ? "更新作品" : "提交作品"}
        </button>
      )}
    </form>
  );
}
