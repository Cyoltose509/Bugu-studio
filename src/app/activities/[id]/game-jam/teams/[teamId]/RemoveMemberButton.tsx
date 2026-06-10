"use client";

import { removeMember } from "../../actions";

export function RemoveMemberButton({
  teamId,
  activityId,
  memberId,
}: {
  teamId: string;
  activityId: string;
  memberId: string;
}) {
  async function handleRemove() {
    if (!confirm("确定移除该成员？")) return;
    await removeMember(teamId, activityId, memberId);
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      className="text-xs px-2 py-1 rounded"
      style={{ color: "#bbb" }}
    >
      移除
    </button>
  );
}
