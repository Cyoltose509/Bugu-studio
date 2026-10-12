"use client";

import { useTransition } from "react";
import { removeMember } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function RemoveMemberButton({
  teamId,
  activityId,
  memberId,
}: {
  teamId: string;
  activityId: string;
  memberId: string;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm(t("teams.confirmRemove"))) return;
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
      {isPending ? t("teams.removing") : t("common.remove")}
    </button>
  );
}
