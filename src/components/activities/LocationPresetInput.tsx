"use client";

import { useId, useState } from "react";
import {
  ACTIVITY_LOCATION_PRESETS,
} from "@/lib/activities/constants";
import { useLang } from "@/lib/i18n/LangProvider";

const CUSTOM_VALUE = "__custom__";
const NONE_VALUE = "__none__";

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
  defaultValue = "",
  id,
}: Props) {
  const { t } = useLang();
  const autoId = useId();
  const selectId = id || autoId;
  const initial = (defaultValue || "").trim();
  const [custom, setCustom] = useState(initial !== "" && !isPreset(initial));
  const [value, setValue] = useState(initial);

  const selectValue = custom ? CUSTOM_VALUE : (value ? value : NONE_VALUE);

  return (
    <div className="space-y-2">
      <label className="block text-sm text-brand-text-body" htmlFor={selectId}>
        {t("location.offlineLabel")}
        <span className="ml-1 text-xs text-brand-text-muted">({t("location.optional")})</span>
      </label>

      <select
        id={selectId}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === NONE_VALUE) {
            setCustom(false);
            setValue("");
            return;
          }
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
        <option value={NONE_VALUE}>{t("location.none")}</option>
        {ACTIVITY_LOCATION_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>{t("location.other")}</option>
      </select>

      {custom && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("location.customPlaceholder")}
          className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading"
        />
      )}

      <input type="hidden" name={name} value={value} />
    </div>
  );
}
