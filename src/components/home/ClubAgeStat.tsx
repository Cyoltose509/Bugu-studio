"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n/LangProvider";

/**
 * 彩蛋：悬停「n年」翻面成「m天」
 * 触屏点击也可翻转
 */
export default function ClubAgeStat({
  years,
  days,
}: {
  years: number;
  days: number;
}) {
  const [pinned, setPinned] = useState(false);
  const { lang, t } = useLang();
  const isEn = lang === "en";

  const yearUnit = isEn ? "yrs" : "年";
  const dayUnit = isEn ? "days" : "天";
  const label = t("stat.clubHistory");
  const aria = isEn
    ? `Club history: ${years} yrs, about ${days.toLocaleString("en-US")} days`
    : `社团历史 ${years} 年，约 ${days} 天`;

  return (
    <button
      type="button"
      className="group mx-auto block cursor-help border-0 bg-transparent p-0 text-center"
      aria-label={aria}
      onClick={() => setPinned((v) => !v)}
    >
      <div className="club-age-stage relative mx-auto w-max max-w-full">
        {/* 用更长的「天」文案撑开宽度，避免翻面后换行 */}
        <span
          className="invisible block text-3xl font-bold whitespace-nowrap"
          aria-hidden
        >
          {days.toLocaleString(isEn ? "en-US" : "zh-CN")}
          {dayUnit}
        </span>
        <div
          className={`club-age-flip absolute inset-0 ${pinned ? "is-flipped" : ""}`}
        >
          <div className="club-age-face club-age-front text-3xl font-bold text-brand-orange whitespace-nowrap">
            {years}
            {yearUnit}
          </div>
          <div className="club-age-face club-age-back text-3xl font-bold text-brand-orange whitespace-nowrap">
            {days.toLocaleString(isEn ? "en-US" : "zh-CN")}
            {dayUnit}
          </div>
        </div>
      </div>
      <div className="text-sm mt-1 text-brand-text-secondary">{label}</div>
    </button>
  );
}
