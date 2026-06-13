"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberDetails } from "@/app/admin/members/actions";

interface Props {
  memberId: string;
  field: "grade" | "joinYear";
  currentValue: number | null;
  /** 需要保留的其他字段值，通过 FormData 传递 */
  preserveValues: Record<string, string>;
}

export default function EditableNumber({ memberId, field, currentValue, preserveValues }: Props) {
  const [localValue, setLocalValue] = useState<number | null>(currentValue);
  const [isPending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const dirty = localValue !== currentValue;

  function step(up: boolean) {
    setLocalValue(prev => {
      if (prev == null) return new Date().getFullYear();
      return up ? Math.min(2100, prev + 1) : Math.max(2000, prev - 1);
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!dirty) return;
    const formData = new FormData();
    formData.set(field, localValue != null ? String(localValue) : "");
    Object.entries(preserveValues).forEach(([k, v]) => formData.set(k, v));

    setPending(true);
    setSaved(false);
    try {
      await updateMemberDetails(memberId, formData);
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setPending(false);
    }
  }

  const display = localValue != null
    ? (field === "grade" ? `${localValue}级` : String(localValue))
    : "未设置";

  return (
    <div className="flex items-center gap-1" style={{ opacity: isPending ? 0.6 : 1 }}>
      <button
        type="button"
        onClick={() => step(false)}
        disabled={isPending}
        className="w-6 h-6 rounded border flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-gray-100 flex-shrink-0"
        style={{ borderColor: "#D0DEE8", color: "#555", lineHeight: 1 }}
      >
        −
      </button>
      <span className="text-xs whitespace-nowrap px-1 min-w-[48px] text-center" style={{ color: "#333" }}>
        {display}
      </span>
      <button
        type="button"
        onClick={() => step(true)}
        disabled={isPending}
        className="w-6 h-6 rounded border flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-gray-100 flex-shrink-0"
        style={{ borderColor: "#D0DEE8", color: "#555", lineHeight: 1 }}
      >
        +
      </button>
      {dirty && !isPending && (
        <button
          type="button"
          onClick={handleSave}
          className="text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ background: "#E38043", color: "#fff" }}
        >
          保存
        </button>
      )}
      {isPending && (
        <span className="text-xs whitespace-nowrap" style={{ color: "#E38043" }}>保存中…</span>
      )}
      {saved && !isPending && (
        <span className="text-xs whitespace-nowrap" style={{ color: "#88C232" }}>✓</span>
      )}
    </div>
  );
}
