export type NotifBucket = "review" | "activity" | "bug";

export const REVIEW_TYPES = [
  "NEW_PROJECT",
  "PROJECT_UPDATE",
  "ACTIVITY_PROPOSAL",
  "JAM_APPLICATION",
  "NEW_USER",
] as const;

export const BUG_TYPES = ["ERROR_REPORT", "CSP_VIOLATION"] as const;

const REVIEW_SET = new Set<string>(REVIEW_TYPES);
const BUG_SET = new Set<string>(BUG_TYPES);

export function bucketOf(type: string): NotifBucket {
  if (BUG_SET.has(type)) return "bug";
  if (REVIEW_SET.has(type)) return "review";
  return "activity";
}

export function prismaTypeFilter(bucket?: string | null) {
  if (bucket === "review") return { type: { in: [...REVIEW_TYPES] } };
  if (bucket === "bug") return { type: { in: [...BUG_TYPES] } };
  if (bucket === "activity") return { type: { notIn: [...REVIEW_TYPES, ...BUG_TYPES] } };
  return {};
}

function asCount(value: number | { _all?: number } | { id?: number }) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "_all" in value && typeof value._all === "number") {
    return value._all;
  }
  return 0;
}

export function splitUnreadByType(
  rows: Array<{ type: string; _count: number | { _all?: number } }>,
) {
  let review = 0;
  let bug = 0;
  let activity = 0;
  for (const row of rows) {
    const n = asCount(row._count);
    const b = bucketOf(row.type);
    if (b === "review") review += n;
    else if (b === "bug") bug += n;
    else activity += n;
  }
  return { count: review + activity + bug, review, activity, bug };
}
