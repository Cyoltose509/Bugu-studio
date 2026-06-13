"use client";

import { useSession } from "next-auth/react";

type ContactData = {
  location?: string | null;
  phone?: string | null;
  wechat?: string | null;
  qq?: string | null;
};

/** 联系方式区块 — 仅 MEMBER+ 可见 */
export default function MemberContactInfo({ data }: { data: ContactData }) {
  const { data: session } = useSession();
  const canSee = session?.user?.role && session.user.role !== "USER";

  if (!canSee) return null;

  const hasAny = data.location || data.phone || data.wechat || data.qq;
  if (!hasAny) return null;

  return (
    <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-brand-navy">
        联系方式
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">仅成员可见</span>
      </h3>
      <div className="space-y-2 text-sm">
        {data.location && <ContactRow label="所在地" value={data.location} />}
        {data.phone && <ContactRow label="电话" value={data.phone} />}
        {data.wechat && <ContactRow label="微信" value={data.wechat} />}
        {data.qq && <ContactRow label="QQ" value={data.qq} />}
      </div>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-brand-text-secondary">{label}</span>
      <span className="text-brand-text-heading">{value}</span>
    </div>
  );
}
