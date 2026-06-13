"use client";

import { useTransition } from "react";
import { removeJudge } from "@/lib/actions/judging";

export function RemoveJudgeButton({
  activityId,
  judgeId,
}: {
  activityId: string;
  judgeId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await removeJudge(activityId, judgeId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      className="text-xs disabled:opacity-40 text-[#bbb]"
    >
      {isPending ? "…" : "✕"}
    </button>
  );
}
