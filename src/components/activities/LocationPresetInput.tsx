"use client";

import { useId, useState } from "react";
import {
  ACTIVITY_LOCATION_PRESETS,
  DEFAULT_ACTIVITY_LOCATION,
} from "@/lib/activities/constants";

type Props = {
  name?: string;
  defaultValue?: string;
  id?: string;
};

export default function LocationPresetInput({
  name = "location",
  defaultValue = DEFAULT_ACTIVITY_LOCATION,
  id,
}: Props) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-presets`;
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor={inputId}>
        线下地点
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {ACTIVITY_LOCATION_PRESETS.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(preset)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                active
                  ? "border-brand-blue bg-brand-surface text-brand-blue"
                  : "border-brand-border-subtle text-brand-text-secondary hover:border-brand-blue/40"
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>
      <input
        id={inputId}
        name={name}
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="线下活动地点"
        className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading"
      />
      <datalist id={listId}>
        {ACTIVITY_LOCATION_PRESETS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
    </div>
  );
}
