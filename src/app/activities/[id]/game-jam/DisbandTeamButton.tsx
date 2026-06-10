"use client";

import { disbandTeam } from "./actions";

export function DisbandTeamButton({ teamId, activityId }: { teamId: string; activityId: string }) {
  async function handleDisband() {
    if (!confirm("确定解散队伍？此操作不可撤销。")) return;
    await disbandTeam(teamId, activityId);
  }

  return (
    <button
      type="button"
      onClick={handleDisband}
      className="text-xs px-3 py-1.5 rounded-lg"
      style={{ color: "#bbb" }}
    >
      解散队伍
    </button>
  );
}
