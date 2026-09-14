"use client";

import { useState } from "react";

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

  return (
    <button
      type="button"
      className="group mx-auto block cursor-help border-0 bg-transparent p-0 text-center"
      aria-label={`社团历史 ${years} 年，约 ${days} 天`}
      onClick={() => setPinned((v) => !v)}
    >
      <div className="club-age-stage relative mx-auto w-max max-w-full">
        {/* 用更长的「天」文案撑开宽度，避免翻面后换行 */}
        <span
          className="invisible block text-3xl font-bold whitespace-nowrap"
          aria-hidden
        >
          {days.toLocaleString("zh-CN")}天
        </span>
        <div
          className={`club-age-flip absolute inset-0 ${pinned ? "is-flipped" : ""}`}
        >
          <div className="club-age-face club-age-front text-3xl font-bold text-brand-orange whitespace-nowrap">
            {years}年
          </div>
          <div className="club-age-face club-age-back text-3xl font-bold text-brand-orange whitespace-nowrap">
            {days.toLocaleString("zh-CN")}天
          </div>
        </div>
      </div>
      <div className="text-sm mt-1 text-brand-text-secondary">社团历史</div>
    </button>
  );
}
