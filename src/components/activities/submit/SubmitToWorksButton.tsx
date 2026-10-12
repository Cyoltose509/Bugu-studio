"use client";

import { useState, useTransition } from "react";
import { submitToWorksLibrary } from "@/lib/actions/submissions";
import { useLang } from "@/lib/i18n/LangProvider";

export default function SubmitToWorksButton({
  activityId,
  submissionId,
  title,
}: {
  activityId: string;
  submissionId: string;
  title: string;
}) {
  const { t } = useLang();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);

  function handleSubmit(formData: FormData) {
    formData.set("submissionId", submissionId);
    start(async () => {
      const result = await submitToWorksLibrary(activityId, formData);
      if (result?.error) {
        alert(result.error);
      }
    });
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity bg-brand-green"
      >
        {pending ? t("form.submitting") : t("submit.submitToWorks")}
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="inline-flex items-center gap-2">
      <select
        name="projectType"
        defaultValue="TRIAL_DEMO"
        className="text-xs rounded border border-brand-border-subtle px-2 py-1 text-brand-text-heading"
      >
        <option value="IN_DEVELOPMENT">{t("work.status.IN_DEVELOPMENT")}</option>
        <option value="TRIAL_DEMO">{t("work.status.TRIAL_DEMO")}</option>
        <option value="MINI_GAME">{t("work.status.MINI_GAME")}</option>
        <option value="OFFICIAL_RELEASE">{t("work.status.OFFICIAL_RELEASE")}</option>
      </select>
      <input
        name="developYear"
        type="number"
        defaultValue={new Date().getFullYear()}
        min={1980}
        max={2100}
        className="text-xs rounded border border-brand-border-subtle px-2 py-1 w-16 text-brand-text-heading"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed bg-brand-green"
      >
        {pending ? t("form.submitting") : t("submit.confirmSubmit")}
      </button>
      <button
        type="button"
        onClick={() => setShowForm(false)}
        disabled={pending}
        className="text-xs px-2 py-1 rounded-lg border border-brand-border-subtle text-brand-text-muted"
      >
        {t("common.cancel")}
      </button>
    </form>
  );
}
