"use client";

import { useTransition } from "react";
import { handleApplication } from "../../actions";

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
        className="text-xs px-3 py-1 rounded text-white disabled:opacity-50"
        style={{ background: "#3388BB" }}
      >
        {isPending ? "处理中…" : "通过"}
      </button>
      <button
        type="button"
        onClick={() => act("REJECTED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded disabled:opacity-50"
        style={{ color: "#999", border: "1px solid #D0DEE8" }}
      >
        {isPending ? "处理中…" : "拒绝"}
      </button>
    </div>
  );
}
