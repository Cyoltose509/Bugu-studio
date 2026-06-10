"use client";

import { useTransition } from "react";
import { handleInvitation } from "./actions";

export function InvitationButtons({
  invitationId,
  activityId,
}: {
  invitationId: string;
  activityId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function act(action: "ACCEPTED" | "REJECTED") {
    startTransition(async () => {
      await handleInvitation(invitationId, activityId, action);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => act("ACCEPTED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded text-white disabled:opacity-50"
        style={{ background: "#3388BB" }}
      >
        {isPending ? "处理中…" : "接受"}
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
