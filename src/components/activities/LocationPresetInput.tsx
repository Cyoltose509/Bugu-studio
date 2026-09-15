"use client";

import { useId, useState } from "react";
import {
  ACTIVITY_LOCATION_PRESETS,
  DEFAULT_ACTIVITY_LOCATION,
} from "@/lib/activities/constants";

const CUSTOM_VALUE = "__custom__";

type Props = {
  name?: string;
  defaultValue?: string;
  id?: string;
};

function isPreset(value: string): boolean {
  return (ACTIVITY_LOCATION_PRESETS as readonly string[]).includes(value);
}

export default function LocationPresetInput({
  name = "location",
  defaultValue = DEFAULT_ACTIVITY_LOCATION,
  id,
}: Props) {
  const autoId = useId();
  const selectId = id || autoId;
  const initial = (defaultValue || "").trim() || DEFAULT_ACTIVITY_LOCATION;
  const [custom, setCustom] = useState(!isPreset(initial));
  const [value, setValue] = useState(initial);

  const selectValue = custom ? CUSTOM_VALUE : value;

  return (
    <div className="space-y-2">
      <label className="block text-sm text-brand-text-body" htmlFor={selectId}>
        线下地点
      </label>

      <select
        id={selectId}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_VALUE) {
            setCustom(true);
            if (isPreset(value)) setValue("");
            return;
          }
          setCustom(false);
          setValue(next);
        }}
        className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading bg-card"
      >
        {ACTIVITY_LOCATION_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>其他地点…</option>
      </select>

      {custom && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入线下活动地点"
          className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading"
        />
      )}

      {/* 始终提交当前地点；空则由服务端回落到默认 */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
