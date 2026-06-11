"use client";

import { useSession } from "next-auth/react";
import { Suspense } from "react";

interface WorkExperienceItem {
  id: string;
  company: string;
  position: string;
  startDate: Date;
  endDate: Date | null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}.${m}`;
}

/** 工作经历展示 — 仅登录的社团成员可见 */
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
    <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
      <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#25547A" }}>
        工作经历
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#FDE8E8", color: "#C62828" }}>仅成员可见</span>
      </h3>
      <div className="space-y-3">
        {experiences.map((exp) => {
          const period = exp.endDate
            ? `${formatDate(new Date(exp.startDate))} ~ ${formatDate(new Date(exp.endDate))}`
            : `${formatDate(new Date(exp.startDate))} ~ 至今`;
          return (
            <div key={exp.id} className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: "#88C232" }} />
              <div className="text-sm min-w-0">
                <div className="font-medium" style={{ color: "#333" }}>{exp.company}</div>
                <div className="text-xs" style={{ color: "#777" }}>
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
