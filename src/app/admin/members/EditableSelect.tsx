"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberDetails } from "./actions";

interface Option {
  value: string;
  label: string;
}

interface Props {
  memberId: string;
  field: "grade" | "position";
  currentValue: string;
  options: Option[];
  /** 需要保留的其他字段值，通过 hidden input 传递 */
  preserveValues: Record<string, string>;
}

export default function EditableSelect({ memberId, field, currentValue, options, preserveValues }: Props) {
  const [localValue, setLocalValue] = useState(currentValue);
  const [isPending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // 手动构造 FormData，避免 DOM 更新时序问题
    const formData = new FormData();
    formData.set(field, newValue);
    Object.entries(preserveValues).forEach(([k, v]) => formData.set(k, v));

    setPending(true);
    setSaved(false);

    try {
      await updateMemberDetails(memberId, formData);
      // 刷新服务器组件数据，页面会显示最新值
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex items-center gap-1">
      {Object.entries(preserveValues).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}
      <input type="hidden" name={field} value={localValue} />
      <select
        value={localValue}
        onChange={handleChange}
        disabled={isPending}
        className="text-xs rounded border px-2 py-1 bg-white cursor-pointer transition-opacity"
        style={{
          borderColor: "#D0DEE8",
          color: "#333",
          minWidth: field === "grade" ? "80px" : undefined,
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {isPending && (
        <span className="text-xs whitespace-nowrap" style={{ color: "#E38043" }}>
          保存中…
        </span>
      )}
      {saved && !isPending && (
        <span className="text-xs whitespace-nowrap" style={{ color: "#88C232" }}>
          ✓ 已保存
        </span>
      )}
    </form>
  );
}
