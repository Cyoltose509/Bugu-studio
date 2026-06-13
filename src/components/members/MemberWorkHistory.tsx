"use client";

import { useSession } from "next-auth/react";
import { Suspense } from "react";
import { formatYearMonth } from "@/lib/utils";

interface WorkExperienceItem {
  id: string;
  type: string;
  company: string;
  position: string;
  startDate: Date;
  endDate: Date | null;
}

/** 经历展示 — 仅登录的社团成员可见 */
export default function MemberWorkHistory({ experiences }: { experiences: WorkExperienceItem[] }) {
  return (
    <Suspense fallback={null}>
      <Inner experiences={experiences} />
    </Suspense>
  );
}

function Inner({ experiences }: { experiences: WorkExperienceItem[] }) {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  const canSee = session?.user?.role && session.user.role !== "USER";
  if (!canSee) return null;

  if (experiences.length === 0) return null;

  return (
    <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-brand-navy">
        经历
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">仅成员可见</span>
      </h3>
      <div className="space-y-3">
        {experiences.map((exp) => {
          const period = exp.endDate
            ? `${formatYearMonth(new Date(exp.startDate))} ~ ${formatYearMonth(new Date(exp.endDate))}`
            : `${formatYearMonth(new Date(exp.startDate))} ~ 至今`;
          const isStudy = exp.type === "学习";
          return (
            <div key={exp.id} className="flex items-start gap-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${isStudy ? "bg-brand-surface text-brand-blue" : "bg-[#FFF3E0] text-brand-orange"}`}>
                {isStudy ? "学习" : "工作"}
              </span>
              <div className="text-sm min-w-0">
                <div className="font-medium text-brand-text-heading">{exp.company}</div>
                <div className="text-xs text-brand-text-secondary">
                  {exp.position} · {period}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
