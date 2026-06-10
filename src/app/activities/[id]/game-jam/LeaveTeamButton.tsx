"use client";

import { useState, useTransition } from "react";
import { leaveTeam } from "./actions";

export function LeaveTeamButton({ teamId, activityId }: { teamId: string; activityId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleLeave() {
    if (!confirm("确定退出队伍？")) return;
    startTransition(async () => {
      await leaveTeam(teamId, activityId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={isPending}
      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
      style={{ color: "#E38043", border: "1px solid #E38043" }}
    >
      {isPending ? "退出中…" : "退出队伍"}
    </button>
  );
}
