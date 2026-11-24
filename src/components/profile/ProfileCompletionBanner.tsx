"use client";

import { useState } from "react";
import Link from "next/link";
import type { MissingProfileItem } from "@/lib/profile/onboarding";

interface ProfileCompletionBannerProps {
  percent: number;
  missing: MissingProfileItem[];
}

/**
 * 个人中心顶部轻量补全提示条（仅在缺年级/头像/职能/简介时出现）
 */
export default function ProfileCompletionBanner({
  percent,
  missing,
}: ProfileCompletionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-blue/25 bg-brand-blue/[0.06] dark:bg-brand-blue/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-brand-navy">
            你的社团名片完整度 {percent}%
          </span>
          <div className="w-24 h-1.5 rounded-full bg-brand-border-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-blue transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-brand-text-secondary">
          还差{" "}
          <span className="font-medium text-brand-text-heading">
            {missing.map((m) => m.label).join("、")}
          </span>
          ，补全后会在成员墙与作品页展示更完整的个人名片
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/onboarding"
          className="btn-primary rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap"
        >
          10 秒快速补全 →
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="暂时关闭提示"
          className="rounded-lg p-1.5 text-xs text-brand-text-muted hover:bg-brand-surface transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
