"use client";

import { useState, useRef } from "react";
import MemberSelector from "@/components/members/MemberSelector";
import { inviteMember } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function InviteMemberForm({ teamId, activityId, existingMemberIds }: {
  teamId: string;
  activityId: string;
  existingMemberIds: string[];
}) {
  const { t } = useLang();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError(t("teams.errSelectInvitee"));
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("inviteeUserId", selectedUserId);
    const result = await inviteMember(teamId, activityId, fd);
    if (result && "error" in result) {
      setError(result.error || t("teams.inviteFailed"));
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
        placeholder={t("teams.inviteSearchPlaceholder")}
        excludeIds={existingMemberIds}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !selectedUserId}
        className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-50 bg-brand-blue"
      >
        {loading ? t("teams.sending") : t("teams.sendInvite")}
      </button>
    </form>
  );
}
