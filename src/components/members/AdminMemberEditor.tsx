"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { updateMemberDetails } from "@/app/admin/members/actions";

interface Props {
  memberId: string;
  currentGrade: number | null;
  currentJoinYear: number | null;
  currentPosition: string;
}

const POSITION_OPTIONS = [
  { value: "MEMBER", label: "成员" },
  { value: "VICE_PRESIDENT", label: "副社长" },
  { value: "PRESIDENT", label: "社长" },
  { value: "PAST_PRESIDENT", label: "往届社长" },
  { value: "PAST_VICE_PRESIDENT", label: "往届副社长" },
  { value: "NON_STUDENT", label: "非本校" },
];

const POSITION_OPTIONS_WITH_FOUNDER = [
  ...POSITION_OPTIONS,
  { value: "FOUNDER", label: "创始人" },
];

export default function AdminMemberEditor({ memberId, currentGrade, currentJoinYear, currentPosition }: Props) {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gradeVal, setGradeVal] = useState(currentGrade ?? null);
  const [joinYearVal, setJoinYearVal] = useState(currentJoinYear ?? null);

  const positionOptions = currentPosition === "FOUNDER" ? POSITION_OPTIONS_WITH_FOUNDER : POSITION_OPTIONS;
  const isFounder = currentPosition === "FOUNDER";

  if (!session?.user || session.user.role !== "ADMIN") return null;

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setSaved(false);
    try {
      await updateMemberDetails(memberId, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl p-5 border bg-[var(--ui-bg-warm-light)] border-brand-orange/30">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded font-medium bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">
          管理员编辑
        </span>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {/* 年级 - 数字步进 */}
        <div>
          <label className="block text-xs font-medium mb-1 text-brand-text-body">年级（以本科入学为起点）</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setGradeVal(v => v != null ? Math.max(2000, v - 1) : new Date().getFullYear())}
              className="w-8 h-8 rounded border flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-muted border-brand-border-subtle" disabled={gradeVal === null}>-</button>
            <input type="number" name="grade" value={gradeVal ?? ""} onChange={e => setGradeVal(e.target.value ? Number(e.target.value) : null)}
              className="w-20 text-center text-sm rounded border px-2 py-1.5 bg-card border-brand-border-subtle"
              min={2000} max={2100} placeholder="未设置" />
            <button type="button" onClick={() => setGradeVal(v => Math.min(2100, (v ?? new Date().getFullYear() - 1) + 1))}
              className="w-8 h-8 rounded border flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-muted border-brand-border-subtle">+</button>
            <span className="text-sm text-brand-text-secondary">{gradeVal != null ? `${gradeVal}级` : "未设置"}</span>
          </div>
        </div>

        {/* 入社年份 - 数字步进 */}
        <div>
          <label className="block text-xs font-medium mb-1 text-brand-text-body">入社年份</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setJoinYearVal(v => v != null ? Math.max(2000, v - 1) : new Date().getFullYear())}
              className="w-8 h-8 rounded border flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-muted border-brand-border-subtle" disabled={joinYearVal === null}>-</button>
            <input type="number" name="joinYear" value={joinYearVal ?? ""} onChange={e => setJoinYearVal(e.target.value ? Number(e.target.value) : null)}
              className="w-20 text-center text-sm rounded border px-2 py-1.5 bg-card border-brand-border-subtle"
              min={2000} max={2100} placeholder="未设置" />
            <button type="button" onClick={() => setJoinYearVal(v => Math.min(2100, (v ?? new Date().getFullYear() - 1) + 1))}
              className="w-8 h-8 rounded border flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-muted border-brand-border-subtle">+</button>
            <span className="text-sm text-brand-text-secondary">{joinYearVal ?? "未设置"}</span>
          </div>
        </div>

        {/* 身份 */}
        <div>
          <label className="block text-xs font-medium mb-1 text-brand-text-body">身份</label>
          <select
            name="position"
            defaultValue={currentPosition}
            disabled={isFounder}
            className="w-full text-sm rounded border px-3 py-2 bg-card cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border-brand-border-subtle text-brand-text-heading"
          >
            {positionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {isFounder && (
            <p className="text-xs mt-1 text-brand-text-muted">创始人身份不可修改</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-white ${saved ? "bg-brand-green" : "bg-brand-orange"}`}
        >
          {saving ? "保存中…" : saved ? "✓ 已保存" : "保存修改"}
        </button>
      </form>
    </div>
  );
}
