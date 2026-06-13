"use client";

import { useState, useTransition } from "react";
import { disbandTeam } from "@/lib/actions/teams";

export function DisbandTeamButton({ teamId, activityId }: { teamId: string; activityId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDisband() {
    if (!confirm("确定解散队伍？此操作不可撤销。")) return;
    startTransition(async () => {
      await disbandTeam(teamId, activityId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDisband}
      disabled={isPending}
      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
      style={{ color: "#bbb" }}
    >
      {isPending ? "解散中…" : "解散队伍"}
    </button>
  );
}
