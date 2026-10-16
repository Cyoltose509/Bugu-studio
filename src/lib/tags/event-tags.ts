/**
 * 活动&赛事标签：预设图标、品牌色、侧栏始终展示
 * 通用 Game Jam（slug: gamejam）在「要素」，不是本栏。
 */

export const EVENT_SLUGS = [
  "bugoo-gamejam",
  "ggj",
  "ciga",
  "cusga",
  "mengyabei",
] as const;

export type EventSlug = (typeof EVENT_SLUGS)[number];

/** 侧栏即使 0 件也展示 */
export const EVENT_PRESET_SLUGS = EVENT_SLUGS;

export const EVENT_TAG_COLORS: Record<EventSlug, string> = {
  "bugoo-gamejam": "#E38043",
  ggj: "#3388BB",
  ciga: "#E38043",
  cusga: "#88C232",
  mengyabei: "#25547A",
};

const EVENT_ALIASES: Record<string, EventSlug> = {
  "bugoo-gamejam": "bugoo-gamejam",
  ggj: "ggj",
  ciga: "ciga",
  cusga: "cusga",
  mengyabei: "mengyabei",
};

export function normalizeEventSlug(slug: string): EventSlug | null {
  return EVENT_ALIASES[slug.toLowerCase()] ?? null;
}

export function isEventTagSlug(slug: string): boolean {
  return normalizeEventSlug(slug) !== null;
}

export function isEventPresetSlug(slug: string): boolean {
  return normalizeEventSlug(slug) !== null;
}

export function getEventColor(slug: string): string | null {
  const key = normalizeEventSlug(slug);
  return key ? EVENT_TAG_COLORS[key] : null;
}

export function getEventChipClass(slug: string): string {
  const key = normalizeEventSlug(slug);
  if (!key) return "";
  const tone = key === "bugoo-gamejam" ? "bugoo" : key;
  return `event-chip event-chip-${tone}`;
}

export function eventIconSrc(slug: string): string | null {
  const key = normalizeEventSlug(slug);
  if (key === "bugoo-gamejam") return "/images/logo.png";
  if (key === "ggj") return "/images/tags/ggj.png";
  return null;
}
