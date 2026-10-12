"use client";

import { useState, useTransition } from "react";
import { leaveTeam } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function LeaveTeamButton({ teamId, activityId }: { teamId: string; activityId: string }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleLeave() {
    if (!confirm(t("teams.confirmLeave"))) return;
    startTransition(async () => {
      await leaveTeam(teamId, activityId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={isPending}
      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 text-brand-orange border border-brand-orange"
    >
      {isPending ? t("teams.leaving") : t("teams.leave")}
    </button>
  );
}
