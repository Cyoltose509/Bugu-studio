/**
 * 作品「按时间」排序
 *
 * 以前用 developYear DESC + publishedAt DESC。两个坑叠在一起：
 * 1. 开发年份优先 —— 今天刚上架的 2025 作品会排在半年前的 2026 作品后面
 * 2. Postgres 对 DESC 默认 NULLS FIRST —— 没填发布时间的旧档反而压过刚发布的
 *
 * 「时间」应对齐用户预期：最近上架的在最前。没有 publishedAt 的再用创建时间，
 * 并显式 NULLS LAST，避免空日期漂到列表头顶。
 */
export const PROJECT_DATE_ORDER_BY = [
  { publishedAt: { sort: "desc" as const, nulls: "last" as const } },
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

type DateRow = {
  id: string;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function stamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

/** 与 PROJECT_DATE_ORDER_BY 同一套：有发布时间的在前，越新越靠前 */
export function compareProjectsByDate(a: DateRow, b: DateRow): number {
  const pa = stamp(a.publishedAt);
  const pb = stamp(b.publishedAt);
  if (pa !== null && pb !== null && pa !== pb) return pb - pa;
  if (pa !== null && pb === null) return -1;
  if (pa === null && pb !== null) return 1;

  const ca = stamp(a.createdAt) ?? 0;
  const cb = stamp(b.createdAt) ?? 0;
  if (cb !== ca) return cb - ca;
  return String(b.id).localeCompare(String(a.id));
}
