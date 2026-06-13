"use client";

import { useState, useRef } from "react";
import MemberSelector from "@/components/members/MemberSelector";
import { addJudge } from "@/lib/actions/judging";

export function AddJudgeForm({ activityId, existingJudgeIds }: {
  activityId: string;
  existingJudgeIds: string[];
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError("请选择评委");
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("judgeUserId", selectedUserId);
    const result = await addJudge(activityId, fd);
    if (result && "error" in result) {
      setError(result.error || "添加失败");
    } else {
      setSelectedUserId("");
    }
    setLoading(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 items-start">
      <div className="flex-1">
        <MemberSelector
          onSelect={(user) => setSelectedUserId(user.id)}
          placeholder="搜索要添加的评委…"
          excludeIds={existingJudgeIds}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || !selectedUserId}
        className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-50 shrink-0 bg-brand-blue"
      >
        {loading ? "添加中…" : "添加评委"}
      </button>
    </form>
  );
}
