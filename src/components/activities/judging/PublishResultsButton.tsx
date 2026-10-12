"use client";

import { useTransition } from "react";
import { publishResults } from "@/lib/actions/judging";
import { useLang } from "@/lib/i18n/LangProvider";

export function PublishResultsButton({ activityId }: { activityId: string }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    if (!confirm(t("judging.confirmPublish"))) return;
    startTransition(async () => {
      await publishResults(activityId);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-sm px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50 bg-[linear-gradient(135deg,#E38043,#FFB347)]"
      onClick={handlePublish}
    >
      {isPending ? t("judging.publishing") : t("judging.publishResults")}
    </button>
  );
}
