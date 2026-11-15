"use client";

import { useState, useTransition } from "react";
import { updateJudgingSettings } from "@/lib/actions/judging";
import { useLang } from "@/lib/i18n/LangProvider";

export function JudgingSettingsForm({
  activityId,
  initialMode = "ONLINE",
  initialPublic = true,
  initialExternalUrl = "",
}: {
  activityId: string;
  initialMode?: string;
  initialPublic?: boolean;
  initialExternalUrl?: string | null;
}) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [externalUrl, setExternalUrl] = useState(initialExternalUrl || "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const fd = new FormData();
    fd.append("judgingMode", mode);
    fd.append("judgesPublic", isPublic ? "true" : "false");
    fd.append("externalJudgingUrl", externalUrl.trim());

    startTransition(async () => {
      const res = await updateJudgingSettings(activityId, fd);
      if (res && "error" in res) {
        setError(res.error || "保存失败");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <div className="rounded-xl border border-brand-border-subtle bg-card p-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-brand-navy">{t("judging.settings")}:</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${
            mode === "ONLINE"
              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
              : mode === "EXTERNAL"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
              : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
          }`}>
            {mode === "ONLINE" ? t("judging.modeOnline") : mode === "EXTERNAL" ? t("judging.modeExternal") : t("judging.modeDisabled")}
          </span>

          <span className={`px-2 py-0.5 rounded-full font-medium ${
            isPublic
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
          }`}>
            {isPublic ? `👁️ ${t("judging.public")}` : `🔒 ${t("judging.private")}`}
          </span>

          {externalUrl && mode === "EXTERNAL" && (
            <span className="text-brand-text-muted truncate max-w-xs" title={externalUrl}>
              🔗 {externalUrl}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-2.5 py-1 rounded-md border border-brand-border-subtle hover:bg-brand-surface text-brand-text-body transition-colors"
        >
          {isOpen ? "收起设置" : "⚙️ 调整模式与公开性"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-brand-border-subtle space-y-4 animate-fade-in text-sm">
          {/* 评审模式选择 */}
          <div>
            <label className="block font-medium mb-1.5 text-xs text-brand-text-secondary">
              {t("judging.mode")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { value: "ONLINE", title: "judging.modeOnline", desc: "评委在站内打分，系统统计均分与排名" },
                { value: "EXTERNAL", title: "judging.modeExternal", desc: "线下路演或站外评分，不使用官网打分" },
                { value: "DISABLED", title: "judging.modeDisabled", desc: "非对抗/纯作品展示，不评比" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                    mode === opt.value
                      ? "border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue"
                      : "border-brand-border-subtle hover:border-brand-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-brand-navy">
                    <input
                      type="radio"
                      name="judgingMode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                      className="text-brand-blue"
                    />
                    {t(opt.title as any)}
                  </div>
                  <span className="text-[11px] text-brand-text-muted mt-1 leading-snug">
                    {opt.desc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 站外评审链接/说明 */}
          {mode === "EXTERNAL" && (
            <div className="animate-fade-in">
              <label className="block font-medium mb-1 text-xs text-brand-text-secondary">
                {t("judging.externalUrl")}
              </label>
              <input
                type="text"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={t("judging.externalUrlPlaceholder")}
                className="w-full text-xs px-3 py-2 rounded-lg border border-brand-border-subtle bg-brand-surface-page text-brand-text-body focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </div>
          )}

          {/* 评委公开性 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="judgesPublicCheckbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-brand-border-subtle text-brand-blue focus:ring-brand-blue"
            />
            <label htmlFor="judgesPublicCheckbox" className="text-xs text-brand-text-body cursor-pointer font-medium select-none">
              {t("judging.public")}
              <span className="text-brand-text-muted font-normal ml-1">
                （取消勾选后评委名单将保密，仅管理员与评委本人可见，前台访客不可见）
              </span>
            </label>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {saved && <p className="text-xs text-green-600 font-medium">✓ 评审设置已保存并生效</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="text-xs px-4 py-1.5 rounded-lg bg-brand-blue text-white font-medium hover:bg-brand-blue-hover disabled:opacity-50 transition-colors"
            >
              {isPending ? "保存中..." : t("judging.saveSettings")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
