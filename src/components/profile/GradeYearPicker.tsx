"use client";

import { useMemo, useState } from "react";
import { getUndergradGradePresets } from "@/lib/profile/onboarding";

interface GradeYearPickerProps {
  value: number | null;
  onChange: (year: number | null) => void;
  /** 可选：选中预设年份时触发（例如自动推测是否已毕业） */
  onSelectPreset?: (year: number) => void;
  /** 紧凑模式（用于 EditForm 内嵌） */
  compact?: boolean;
  id?: string;
}

/**
 * 本科入学年份一键点选胶囊（如 2026级 / 2025级 / 2024级 ...）
 * 支持展开输入更早/其他年份。
 */
export default function GradeYearPicker({
  value,
  onChange,
  onSelectPreset,
  compact = false,
  id = "grade",
}: GradeYearPickerProps) {
  const presets = useMemo(() => getUndergradGradePresets(), []);
  const isCustomValue = value != null && !presets.includes(value);
  const [showCustom, setShowCustom] = useState(isCustomValue);
  const [customDraft, setCustomDraft] = useState(isCustomValue && value ? String(value) : "");

  const handlePresetClick = (year: number) => {
    setShowCustom(false);
    setCustomDraft("");
    onChange(year);
    onSelectPreset?.(year);
  };

  const handleCustomChange = (raw: string) => {
    setCustomDraft(raw);
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length === 4) {
      const parsed = Number(digits);
      if (parsed >= 2000 && parsed <= 2100) {
        onChange(parsed);
        onSelectPreset?.(parsed);
        return;
      }
    }
    if (!digits) {
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="本科入学年份">
        {presets.map((year) => {
          const active = value === year;
          return (
            <button
              key={year}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handlePresetClick(year)}
              className={`rounded-lg border font-medium transition-all cursor-pointer ${
                compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
              } ${
                active
                  ? "border-brand-navy bg-brand-navy text-white shadow-sm"
                  : "border-brand-border-subtle bg-card text-brand-text-body hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {year}级
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCustom((prev) => !prev)}
          className={`rounded-lg border border-dashed font-medium transition-colors cursor-pointer ${
            compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
          } ${
            showCustom || isCustomValue
              ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
              : "border-brand-border-subtle bg-card text-brand-text-muted hover:border-brand-blue hover:text-brand-blue"
          }`}
        >
          {isCustomValue && value ? `${value}级` : "其他年份"}
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            min={2000}
            max={2100}
            inputMode="numeric"
            value={customDraft}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="例如 2020"
            className="w-32 rounded-lg border border-brand-border-subtle bg-card px-3 py-1.5 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
          <span className="text-xs text-brand-text-muted">输入 4 位本科入学年份（如 2020）</span>
        </div>
      )}
    </div>
  );
}
