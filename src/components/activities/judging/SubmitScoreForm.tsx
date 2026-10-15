"use client";

import { useState, useTransition } from "react";
import { submitScore } from "@/lib/actions/judging";
import { useLang } from "@/lib/i18n/LangProvider";

const QUICK_SCORES = [50, 60, 70, 80, 90];

function ScoreSlider({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  // 渐变色：低分红 → 中分橙 → 高分绿
  const trackColor =
    pct < 35 ? "#e57373" : pct < 65 ? "#FFB347" : "#88C232";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs font-medium text-brand-text-body">{label}</span>
          <span className="text-[10px] ml-1.5 text-[#aaa]">{desc}</span>
        </div>
        <span
          className={`text-sm font-bold tabular-nums min-w-[2rem] text-right ${pct < 35 ? "text-[#e57373]" : pct < 65 ? "text-[#FFB347]" : "text-brand-green"}`}
        >
          {value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#ccc]">0</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${pct}%, #e0e0e0 ${pct}%, #e0e0e0 100%)`,
            accentColor: trackColor,
          }}
        />
        <span className="text-[10px] text-[#ccc]">100</span>
      </div>
    </div>
  );
}

export function SubmitScoreForm({
  activityId,
  submissionId,
  myScore,
}: {
  activityId: string;
  submissionId: string;
  myScore: any;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();
  const criteria = (myScore?.criteria || {}) as Record<string, number>;

  const [art, setArt] = useState(criteria.art ?? criteria.creativity ?? 0);
  const [story, setStory] = useState(criteria.story ?? criteria.execution ?? 0);
  const [gameplay, setGameplay] = useState(criteria.gameplay ?? criteria.theme ?? 0);

  const avgScore = Math.round((art + story + gameplay) / 3);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitScore(activityId, formData);
    });
  }

  return (
    <details className="mt-2">
      <summary
        className={`text-xs cursor-pointer list-none inline-flex items-center gap-1.5 ${myScore ? "text-brand-blue" : "text-brand-orange"}`}
      >
        {myScore ? t("judging.editScore") : t("judging.score")}
      </summary>
      <form action={handleSubmit} className="mt-3 space-y-3 p-3 rounded-lg bg-[#F8FAFB]">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="art" value={art} />
        <input type="hidden" name="story" value={story} />
        <input type="hidden" name="gameplay" value={gameplay} />

        {/* 三个维度滑块 */}
        <div className="space-y-3">
          <ScoreSlider label={t("judging.dim.art")} desc={t("judging.dim.artDesc")} value={art} onChange={setArt} disabled={isPending} />
          <ScoreSlider label={t("judging.dim.story")} desc={t("judging.dim.storyDesc")} value={story} onChange={setStory} disabled={isPending} />
          <ScoreSlider label={t("judging.dim.gameplay")} desc={t("judging.dim.gameplayDesc")} value={gameplay} onChange={setGameplay} disabled={isPending} />
        </div>

        {/* 快捷选分 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] mr-1 text-[#bbb]">{t("judging.quickScores")}</span>
          {QUICK_SCORES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={() => {
                setArt(s);
                setStory(s);
                setGameplay(s);
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40 ${
                art === s && story === s && gameplay === s
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-brand-border-subtle bg-card text-brand-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 综合分预览 */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#E8F4FD]"
        >
          <span className="text-xs font-medium text-brand-navy">
            {t("judging.avgScore")}
          </span>
          <span
            className={`text-lg font-bold ${avgScore < 35 ? "text-[#e57373]" : avgScore < 65 ? "text-brand-orange" : "text-[var(--ui-text-green)]"}`}
          >
            {avgScore}
            <span className="text-xs font-normal ml-1 text-brand-text-muted">/ 100</span>
          </span>
        </div>

        {/* 评语 */}
        <div>
          <label className="block text-xs mb-1 text-brand-text-secondary">{t("judging.commentOptional")}</label>
          <textarea
            name="comment"
            rows={2}
            defaultValue={myScore?.comment || ""}
            disabled={isPending}
            className="w-full rounded-lg border border-brand-border-subtle px-3 py-1.5 text-sm resize-y disabled:opacity-50"
            placeholder={t("judging.commentPlaceholderWork")}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-4 py-1.5 rounded-lg text-white disabled:opacity-50 transition-colors bg-brand-blue"
        >
          {isPending ? t("form.submitting") : myScore ? t("judging.updateScore") : t("judging.submitScore")}
        </button>
      </form>
    </details>
  );
}
