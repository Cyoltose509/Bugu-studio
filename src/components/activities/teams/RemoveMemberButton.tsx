"use client";

import { useTransition } from "react";
import { removeMember } from "@/lib/actions/teams";

export function RemoveMemberButton({
  teamId,
  activityId,
  memberId,
}: {
  teamId: string;
  activityId: string;
  memberId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm("确定移除该成员？")) return;
    startTransition(async () => {
      await removeMember(teamId, activityId, memberId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      className="text-xs px-2 py-1 rounded disabled:opacity-40 text-[#bbb]"
    >
      {isPending ? "移除中…" : "移除"}
    </button>
  );
}
