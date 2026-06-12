"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "./actions";

const ROLE_OPTIONS = [
  { value: "USER", label: "普通用户" },
  { value: "MEMBER", label: "成员" },
  { value: "ADMIN", label: "管理员" },
];

export default function RoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localRole, setLocalRole] = useState(currentRole);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRole = e.target.value;
      setLocalRole(newRole);
      setPending(true);
      setSaved(false);

      const formData = new FormData();
      formData.set("role", newRole);

      try {
        await updateUserRole(userId, formData);
        router.refresh();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setLocalRole(currentRole); // 恢复原值
      } finally {
        setPending(false);
      }
    },
    [userId, currentRole, router]
  );

  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={localRole}
        onChange={handleChange}
        disabled={pending}
        className="text-xs rounded border px-1 py-0.5 disabled:opacity-60"
        style={{ borderColor: "#D0DEE8", color: "#333", background: "#fff" }}
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {pending && (
        <span className="text-xs" style={{ color: "#E38043" }}>
          保存中…
        </span>
      )}
      {saved && !pending && (
        <span className="text-xs" style={{ color: "#88C232" }}>
          ✓ 已保存
        </span>
      )}
    </div>
  );
}
