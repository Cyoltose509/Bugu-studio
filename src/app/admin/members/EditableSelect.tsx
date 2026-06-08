"use client";

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
  return (
    <form action={updateMemberDetails.bind(null, memberId)} className="flex items-center gap-1">
      {Object.entries(preserveValues).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}
      <select
        name={field}
        defaultValue={currentValue}
        className="text-xs rounded border px-2 py-1 bg-white cursor-pointer"
        style={{ borderColor: "#D0DEE8", color: "#333", minWidth: field === "grade" ? "80px" : undefined }}
        onChange={(e) => e.target.form?.requestSubmit()}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </form>
  );
}
