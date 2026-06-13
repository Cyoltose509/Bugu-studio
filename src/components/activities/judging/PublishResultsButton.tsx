"use client";

import { useTransition } from "react";
import { publishResults } from "@/lib/actions/judging";

export function PublishResultsButton({ activityId }: { activityId: string }) {
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    if (!confirm("确定公布比赛结果？公布后将结束活动。")) return;
    startTransition(async () => {
      await publishResults(activityId);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-sm px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50 bg-[linear-gradient(135deg,#E38043,#FFB347)]"
      onClick={handlePublish}
    >
      {isPending ? "公布中…" : "🏆 公布结果"}
    </button>
  );
}
