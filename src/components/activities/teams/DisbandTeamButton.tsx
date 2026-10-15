"use client";

import { useState, useTransition } from "react";
import { disbandTeam } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function DisbandTeamButton({ teamId, activityId }: { teamId: string; activityId: string }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleDisband() {
    if (!confirm(t("teams.confirmDisband"))) return;
    startTransition(async () => {
      await disbandTeam(teamId, activityId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDisband}
      disabled={isPending}
      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 text-[#bbb]"
    >
      {isPending ? t("teams.disbanding") : t("teams.disband")}
    </button>
  );
}
