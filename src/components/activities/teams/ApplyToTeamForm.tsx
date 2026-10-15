"use client";

import { useTransition } from "react";
import { applyToTeam } from "@/lib/actions/teams";
import { useLang } from "@/lib/i18n/LangProvider";

export function ApplyToTeamForm({
  teamId,
  activityId,
}: {
  teamId: string;
  activityId: string;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await applyToTeam(teamId, activityId, formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <textarea name="message" rows={2} placeholder={t("teams.applyMessagePlaceholder")}
        disabled={isPending}
        className="w-full rounded-lg border border-brand-border-subtle px-3 py-2 text-sm resize-y disabled:opacity-50" />
      <button type="submit" disabled={isPending}
        className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50 bg-brand-orange">
        {isPending ? t("form.submitting") : t("teams.submitApplication")}
      </button>
    </form>
  );
}
