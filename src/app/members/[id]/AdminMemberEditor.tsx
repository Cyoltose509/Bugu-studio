"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { updateMemberDetails } from "@/app/admin/members/actions";

interface Props {
  memberId: string;
  currentGrade: string | null;
  currentPosition: string;
  isActive: boolean;
}

const GRADE_OPTIONS = Array.from(
  { length: new Date().getFullYear() - 2017 },
  (_, i) => 2018 + i
);

const POSITION_OPTIONS = [
  { value: "MEMBER", label: "成员" },
  { value: "VICE_PRESIDENT", label: "副社长" },
  { value: "PRESIDENT", label: "社长" },
];

export default function AdminMemberEditor({ memberId, currentGrade, currentPosition, isActive }: Props) {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    <div className="rounded-xl p-5 border" style={{ background: "#FFF8F0", borderColor: "#F09055" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#C62828", color: "#fff" }}>
          管理员编辑
        </span>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {/* 年级 */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#555" }}>年级</label>
          <select
            name="grade"
            defaultValue={currentGrade ?? ""}
            className="w-full text-sm rounded border px-3 py-2 bg-white cursor-pointer"
            style={{ borderColor: "#D0DEE8", color: "#333" }}
          >
            <option value="">未设置</option>
            {GRADE_OPTIONS.map((y) => (
              <option key={y} value={`${y}级`}>{y}级</option>
            ))}
          </select>
        </div>

        {/* 身份 */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#555" }}>身份</label>
          <select
            name="position"
            defaultValue={currentPosition}
            className="w-full text-sm rounded border px-3 py-2 bg-white cursor-pointer"
            style={{ borderColor: "#D0DEE8", color: "#333" }}
          >
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 退役 / 活跃 */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#555" }}>状态</label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#333" }}>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={isActive}
              value="true"
              className="rounded"
            />
            现役活跃
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: saved ? "#88C232" : "#E38043",
            color: "#fff",
          }}
        >
          {saving ? "保存中…" : saved ? "✓ 已保存" : "保存修改"}
        </button>
      </form>
    </div>
  );
}
