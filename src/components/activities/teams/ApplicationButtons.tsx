"use client";

import { useTransition } from "react";
import { handleApplication } from "@/lib/actions/teams";

export function ApplicationButtons({
  teamId,
  activityId,
  applicationId,
}: {
  teamId: string;
  activityId: string;
  applicationId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function act(status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await handleApplication(teamId, activityId, applicationId, status);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => act("APPROVED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded text-white disabled:opacity-50 bg-brand-blue"
      >
        {isPending ? "处理中…" : "通过"}
      </button>
      <button
        type="button"
        onClick={() => act("REJECTED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded disabled:opacity-50 text-brand-text-muted border border-brand-border-subtle"
      >
        {isPending ? "处理中…" : "拒绝"}
      </button>
    </div>
  );
}
