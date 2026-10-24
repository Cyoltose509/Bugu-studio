import type { Lang } from "@/lib/i18n/config";

const CN_DATE_TITLE = /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(例会))?$/;
const NUMERIC_DATE_TITLE = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s*(例会))?$/;

/** Translate only predictable system-style activity titles. Custom titles stay verbatim. */
export function localizeActivityTitle(title: string, lang: Lang): string {
  if (lang !== "en") return title;
  const trimmed = title.trim();
  if (trimmed === "例会") return "Regular Meeting";

  const match = trimmed.match(CN_DATE_TITLE) || trimmed.match(NUMERIC_DATE_TITLE);
  if (!match) return title;
  const [, year, month, day, meeting] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return title;
  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  return meeting ? `Regular Meeting · ${formatted}` : formatted;
}
