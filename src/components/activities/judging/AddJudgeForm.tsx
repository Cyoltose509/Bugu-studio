"use client";

import { useState, useRef } from "react";
import MemberSelector from "@/components/members/MemberSelector";
import { addJudge } from "@/lib/actions/judging";
import { useLang } from "@/lib/i18n/LangProvider";

export function AddJudgeForm({ activityId, existingJudgeIds }: {
  activityId: string;
  existingJudgeIds: string[];
}) {
  const { t } = useLang();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError(t("judging.errSelectJudge"));
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("judgeUserId", selectedUserId);
    const result = await addJudge(activityId, fd);
    if (result && "error" in result) {
      setError(result.error || t("profile.edit.addFailed"));
    } else {
      setSelectedUserId("");
    }
    setLoading(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 items-start">
      <div className="flex-1">
        <MemberSelector
          onSelect={(user) => setSelectedUserId(user.id)}
          placeholder={t("judging.searchJudgePlaceholder")}
          excludeIds={existingJudgeIds}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || !selectedUserId}
        className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-50 shrink-0 bg-brand-blue"
      >
        {loading ? t("judging.adding") : t("judging.addJudge")}
      </button>
    </form>
  );
}
