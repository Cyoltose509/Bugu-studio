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
    <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
      <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#25547A" }}>
        经历
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#FDE8E8", color: "#C62828" }}>仅成员可见</span>
      </h3>
      <div className="space-y-3">
        {experiences.map((exp) => {
          const period = exp.endDate
            ? `${formatYearMonth(new Date(exp.startDate))} ~ ${formatYearMonth(new Date(exp.endDate))}`
            : `${formatYearMonth(new Date(exp.startDate))} ~ 至今`;
          const isStudy = exp.type === "学习";
          return (
            <div key={exp.id} className="flex items-start gap-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5"
                    style={{ background: isStudy ? "#E6F0F8" : "#FFF3E0", color: isStudy ? "#3388BB" : "#E38043" }}>
                {isStudy ? "学习" : "工作"}
              </span>
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
