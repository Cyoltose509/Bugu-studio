"use client";

import { publishResults } from "../actions";

export function PublishResultsButton({ activityId }: { activityId: string }) {
  async function handlePublish() {
    if (!confirm("确定公布比赛结果？公布后将结束活动。")) return;
    await publishResults(activityId);
  }

  return (
    <button
      type="button"
      className="text-sm px-4 py-2 rounded-lg text-white font-semibold"
      style={{ background: "linear-gradient(135deg, #E38043, #FFB347)" }}
      onClick={handlePublish}
    >
      🏆 公布结果
    </button>
  );
}
