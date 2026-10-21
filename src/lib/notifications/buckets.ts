export type NotifBucket = "review" | "activity" | "bug";

/** 管理员审核队列。入队申请发给队长，不算这个栏目。 */
export const REVIEW_TYPES = [
  "NEW_PROJECT",
  "PROJECT_UPDATE",
  "ACTIVITY_PROPOSAL",
  "NEW_USER",
] as const;

export const BUG_TYPES = ["ERROR_REPORT", "CSP_VIOLATION"] as const;

/** 只有管理员会收到、也能看到的类型。 */
export const ADMIN_ONLY_TYPES = [...REVIEW_TYPES, ...BUG_TYPES] as const;

const REVIEW_SET = new Set<string>(REVIEW_TYPES);
const BUG_SET = new Set<string>(BUG_TYPES);
const ADMIN_ONLY_SET = new Set<string>(ADMIN_ONLY_TYPES);

export function notificationTabs(isAdmin: boolean): NotifBucket[] {
  return isAdmin ? ["review", "activity", "bug"] : [];
}

export function bucketOf(type: string): NotifBucket {
  if (BUG_SET.has(type)) return "bug";
  if (REVIEW_SET.has(type)) return "review";
  return "activity";
}

export function prismaTypeFilter(bucket?: string | null) {
  if (bucket === "review") return { type: { in: [...REVIEW_TYPES] } };
  if (bucket === "bug") return { type: { in: [...BUG_TYPES] } };
  if (bucket === "activity") return { type: { notIn: [...ADMIN_ONLY_TYPES] } };
  return {};
}

/** 非管理员忽略栏目参数，并且看不到审核和 bug。 */
export function visibleTypeFilter(isAdmin: boolean, bucket?: string | null) {
  if (!isAdmin) return { type: { notIn: [...ADMIN_ONLY_TYPES] } };
  return prismaTypeFilter(bucket);
}

export function isAdminOnlyType(type: string) {
  return ADMIN_ONLY_SET.has(type);
}

export function unreadForViewer(
  unread: { count: number; review: number; activity: number; bug: number },
  isAdmin: boolean,
) {
  if (isAdmin) return unread;
  return { count: unread.activity, review: 0, activity: unread.activity, bug: 0 };
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
