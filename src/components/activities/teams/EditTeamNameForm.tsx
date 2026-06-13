"use client";

import { useTransition } from "react";
import { updateTeam } from "@/lib/actions/teams";

export function EditTeamNameForm({
  teamId,
  activityId,
  defaultName,
}: {
  teamId: string;
  activityId: string;
  defaultName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateTeam(teamId, activityId, formData);
    });
  }

  return (
    <form action={handleSubmit} className="mt-2 flex gap-2">
      <input name="name" defaultValue={defaultName} maxLength={30} required
        disabled={isPending}
        className="flex-1 rounded-lg border border-brand-border-subtle px-3 py-1.5 text-sm disabled:opacity-50" />
      <button type="submit" disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 bg-brand-blue">
        {isPending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
