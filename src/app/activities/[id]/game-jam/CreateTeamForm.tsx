"use client";

import { useTransition } from "react";
import { createTeam } from "./actions";

export function CreateTeamForm({ activityId }: { activityId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createTeam(activityId, formData);
    });
  }

  return (
    <details className="group">
      <summary className="text-sm px-4 py-2 rounded-lg border cursor-pointer list-none" style={{ borderColor: "#D0DEE8", color: "#555" }}>
        创建队伍
      </summary>
      <form action={handleSubmit} className="mt-3 space-y-2">
        <input name="name" placeholder="队伍名称（1-30字）" maxLength={30} required
          disabled={isPending}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
        <button type="submit" disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "#E38043" }}>
          {isPending ? "创建中…" : "创建"}
        </button>
      </form>
    </details>
  );
}
