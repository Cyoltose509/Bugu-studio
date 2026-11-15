"use client";

import { useState, useRef, useTransition } from "react";
import MemberSelector from "@/components/members/MemberSelector";
import { addJudge, joinAdminAsJudge } from "@/lib/actions/judging";
import { useLang } from "@/lib/i18n/LangProvider";

export function AddJudgeForm({
  activityId,
  existingJudgeIds,
  canJoinSelf = false,
}: {
  activityId: string;
  existingJudgeIds: string[];
  canJoinSelf?: boolean;
}) {
  const { t } = useLang();
  const [mode, setMode] = useState<"member" | "external">("member");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPendingJoin, startJoinTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "member" && !selectedUserId) {
      setError(t("judging.errSelectJudge"));
      return;
    }
    if (mode === "external" && !externalName.trim()) {
      setError(t("judging.errSelectJudge"));
      return;
    }

    setLoading(true);
    const fd = new FormData();
    if (mode === "member") {
      fd.append("judgeUserId", selectedUserId);
    } else {
      fd.append("externalName", externalName.trim());
    }
    if (title.trim()) {
      fd.append("title", title.trim());
    }

    const result = await addJudge(activityId, fd);
    if (result && "error" in result) {
      setError(result.error || t("profile.edit.addFailed"));
    } else {
      setSelectedUserId("");
      setExternalName("");
      setTitle("");
    }
    setLoading(false);
  }

  function handleJoinSelf() {
    startJoinTransition(async () => {
      const res = await joinAdminAsJudge(activityId);
      if (res && "error" in res) {
        setError(res.error || t("profile.edit.addFailed"));
      }
    });
  }

  return (
    <div className="space-y-3 pt-2">
      {/* 选项卡 + 快捷入团 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border-subtle pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setMode("member"); setError(""); }}
            className={`text-xs px-2.5 py-1 rounded-md transition-all ${
              mode === "member"
                ? "bg-brand-blue text-white font-medium shadow-sm"
                : "text-brand-text-muted hover:text-brand-text-body bg-brand-surface"
            }`}
          >
            {t("judging.siteMember")}
          </button>
          <button
            type="button"
            onClick={() => { setMode("external"); setError(""); }}
            className={`text-xs px-2.5 py-1 rounded-md transition-all ${
              mode === "external"
                ? "bg-brand-blue text-white font-medium shadow-sm"
                : "text-brand-text-muted hover:text-brand-text-body bg-brand-surface"
            }`}
          >
            {t("judging.externalJudge")}
          </button>
        </div>

        {canJoinSelf && (
          <button
            type="button"
            onClick={handleJoinSelf}
            disabled={isPendingJoin}
            className="text-xs px-2.5 py-1 rounded-md border border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-all font-medium disabled:opacity-50"
          >
            {isPendingJoin ? "..." : `+ ${t("judging.joinMyself")}`}
          </button>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 items-start">
          {mode === "member" ? (
            <div className="flex-1 w-full min-w-0">
              <MemberSelector
                onSelect={(user) => setSelectedUserId(user.id)}
                placeholder={t("judging.searchJudgePlaceholder")}
                excludeIds={existingJudgeIds}
              />
            </div>
          ) : (
            <div className="flex-1 w-full min-w-0">
              <input
                type="text"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                placeholder={t("judging.judgeName")}
                maxLength={80}
                required
                className="w-full text-sm px-3 py-2 rounded-lg border border-brand-border-subtle bg-card text-brand-text-body focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </div>
          )}

          <div className="w-full sm:w-56 shrink-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("judging.judgeTitlePlaceholder")}
              maxLength={60}
              className="w-full text-sm px-3 py-2 rounded-lg border border-brand-border-subtle bg-card text-brand-text-body focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (mode === "member" ? !selectedUserId : !externalName.trim())}
            className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-40 shrink-0 bg-brand-blue hover:bg-brand-blue-hover transition-colors w-full sm:w-auto"
          >
            {loading ? t("judging.adding") : (mode === "member" ? t("judging.addJudge") : t("judging.addExternalJudge"))}
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </form>
    </div>
  );
}
