"use client";

import { useState, useRef } from "react";
import MemberSelector from "@/components/members/MemberSelector";
import { inviteMember } from "@/lib/actions/teams";

export function InviteMemberForm({ teamId, activityId, existingMemberIds }: {
  teamId: string;
  activityId: string;
  existingMemberIds: string[];
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError("请选择要邀请的成员");
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("inviteeUserId", selectedUserId);
    const result = await inviteMember(teamId, activityId, fd);
    if (result && "error" in result) {
      setError(result.error || "邀请失败");
    } else {
      setSelectedUserId("");
      setError("");
    }
    setLoading(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <MemberSelector
        onSelect={(user) => setSelectedUserId(user.id)}
        placeholder="搜索要邀请的成员…"
        excludeIds={existingMemberIds}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !selectedUserId}
        className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-50 bg-brand-blue"
      >
        {loading ? "发送中…" : "发送邀请"}
      </button>
    </form>
  );
}
