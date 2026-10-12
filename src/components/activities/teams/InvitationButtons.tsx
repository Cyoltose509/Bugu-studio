"use client";

import { useTransition } from "react";
import { handleInvitation } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function InvitationButtons({
  invitationId,
  activityId,
}: {
  invitationId: string;
  activityId: string;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function act(action: "ACCEPTED" | "REJECTED") {
    startTransition(async () => {
      await handleInvitation(invitationId, activityId, action);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => act("ACCEPTED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded text-white disabled:opacity-50 bg-brand-blue"
      >
        {isPending ? t("common.processing") : t("common.accept")}
      </button>
      <button
        type="button"
        onClick={() => act("REJECTED")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded disabled:opacity-50 text-brand-text-muted border border-brand-border-subtle"
      >
        {isPending ? t("common.processing") : t("common.reject")}
      </button>
    </div>
  );
}
