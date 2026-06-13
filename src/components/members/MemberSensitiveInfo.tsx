"use client";

import { useSession } from "next-auth/react";
import { Suspense } from "react";

interface SensitiveData {
  realName?: string | null;
  college?: string | null;
  major?: string | null;
  workLocation?: string | null;
  workPosition?: string | null;
  isGraduated: boolean;
}

/** 敏感信息区块 — 仅登录的社团成员可见 */
export default function MemberSensitiveInfo({ data }: { data: SensitiveData }) {
  return (
    <Suspense fallback={null}>
      <Inner data={data} />
    </Suspense>
  );
}

function Inner({ data }: { data: SensitiveData }) {
  const { data: session, status } = useSession();

  // 加载中不显示
  if (status === "loading") return null;

  // 非成员不可见
  const canSee = session?.user?.role && session.user.role !== "USER";
  if (!canSee) return null;

  const items: { label: string; value: string }[] = [];
  if (data.realName) items.push({ label: "真名", value: data.realName });
  if (!data.isGraduated) {
    if (data.college) items.push({ label: "学院", value: data.college });
    if (data.major) items.push({ label: "专业", value: data.major });
  } else {
    if (data.workLocation) items.push({ label: "工作所在地", value: data.workLocation });
    if (data.workPosition) items.push({ label: "工作岗位", value: data.workPosition });
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-brand-navy">
        详细信息
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">仅成员可见</span>
      </h3>
      <dl className="space-y-2.5 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between">
            <dt className="text-brand-text-secondary">{item.label}</dt>
            <dd className="text-brand-text-heading">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
