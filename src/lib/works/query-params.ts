/**
 * /works 查询参数的收敛层。
 *
 * 页面和 /api/works 都把这些值直接拼进 Prisma 的 where，Postgres 是强类型枚举，
 * 一旦传进枚举外的字符串就抛 `22P02 invalid input value for enum "ProjectType"`，
 * 整页 500。2026-11-25 那批报错就是这么来的：数据库的 ProjectType 已经收缩成
 * 三档，但旧链接（别人的收藏、外站爬虫、手改 URL）还在传 `types=MINI_GAME`。
 *
 * 规矩定在这里：只放行 PROJECT_TYPE_VALUES 里真实存在的值，认不得的丢掉，
 * 退化成「不筛类型」，宁可少筛一次也不要整页崩。枚举增删时只改这一个常量。
 */

/** 与数据库 ProjectType 枚举保持一致的合法取值 */
export const PROJECT_TYPE_VALUES = ["IN_DEVELOPMENT", "TRIAL_DEMO", "OFFICIAL_RELEASE"] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPE_VALUES)[number];

const VALID_TYPES = new Set<string>(PROJECT_TYPE_VALUES);

/** 更早期的写法还留在老链接里，能对上语义的就翻译过去 */
const LEGACY_TYPE_ALIASES: Record<string, ProjectTypeValue> = {
  STEAM: "OFFICIAL_RELEASE",
  DEMO: "TRIAL_DEMO",
  ITCH: "TRIAL_DEMO",
};

export function isProjectType(value: unknown): value is ProjectTypeValue {
  return typeof value === "string" && VALID_TYPES.has(value);
}

/**
 * 逗号分隔的 types 参数 → 合法类型数组。
 * 去重且保持出现顺序；一个都不认时返回空数组（调用方按「不筛」处理）。
 */
export function parseProjectTypes(raw: string | null | undefined): ProjectTypeValue[] {
  if (!raw) return [];
  const picked: ProjectTypeValue[] = [];
  for (const piece of raw.split(",")) {
    const key = piece.trim().toUpperCase();
    if (!key) continue;
    const mapped = LEGACY_TYPE_ALIASES[key] ?? (VALID_TYPES.has(key) ? (key as ProjectTypeValue) : null);
    if (mapped && !picked.includes(mapped)) picked.push(mapped);
  }
  return picked;
}

/** 开发年份只接受四位整数，越界或非数字一律当没传 */
export function parseDevelopYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (!/^\d{4}$/.test(raw.trim())) return null;
  const year = Number(raw);
  return year >= 2000 && year <= 2100 ? year : null;
}

export type WorksQuery = {
  q?: string;
  types?: string;
  tag?: string;
  year?: string;
  sort?: string;
};

const SORTS = new Set(["date", "name", "likes"]);

/** 把 URL 上的原始参数洗成可以直接进 Prisma 的形态 */
export function normalizeWorksParams(raw: WorksQuery): WorksQuery {
  const types = parseProjectTypes(raw.types);
  const year = parseDevelopYear(raw.year);
  return {
    ...raw,
    types: types.length > 0 ? types.join(",") : undefined,
    year: year ? String(year) : undefined,
    sort: raw.sort && SORTS.has(raw.sort) ? raw.sort : undefined,
  };
}
