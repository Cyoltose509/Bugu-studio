/**
 * Game Jam 活动参赛作品占位条目、奖项（金/银/铜）与排序工具
 *
 * 规则：
 * 1. 奖项（trophy）：支持 GOLD（金奖）、SILVER（银奖）、BRONZE（铜奖），数目不限；
 * 2. 名次分栏：隐形分为「排序栏」（sortOrder 为非负整数）与「未排序栏」（sortOrder 为 null）；
 * 3. 自动标排序：处于「排序栏」的条目按顺序自动标记名次 #1, #2, #3...；
 * 4. 页面内展示顺序：
 *    - 获奖作品条目（金 → 银 → 铜）置顶；
 *    - 随后为其余处于「排序栏」的条目（按名次顺序）；
 *    - 最后为「未排序栏」条目，且未排序栏游戏显示顺序随机。
 */

export type JamTrophyType = "GOLD" | "SILVER" | "BRONZE";

export const JAM_TROPHY_ORDER: Record<JamTrophyType, number> = {
  GOLD: 1,
  SILVER: 2,
  BRONZE: 3,
};

export const JAM_ADMIN_ENTRY_TOPIC = "__ADMIN_ENTRY__";

export interface JamCreatorItem {
  name: string;
  roles: string[];
  userId?: string;
  memberId?: string;
  avatar?: string | null;
}

export interface JamSubmissionMeta {
  coverImage?: string;
  teamName?: string;
  creators: JamCreatorItem[];
  trophy: JamTrophyType | null;
  sortOrder: number | null;
  isAdminPlaceholder: boolean;
  links: { label: string; url: string }[];
  tagIds: string[];
  customTags: string[];
}

export function isValidJamTrophy(val: unknown): val is JamTrophyType {
  return val === "GOLD" || val === "SILVER" || val === "BRONZE";
}

export function normalizeJamScreenshots(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    .map((f) => f.trim())
    .slice(0, 3);
}

export function parseJamSubmissionMeta(raw: unknown): JamSubmissionMeta {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const coverImage =
    typeof obj.coverImage === "string" && obj.coverImage.trim()
      ? obj.coverImage.trim()
      : undefined;

  const teamName =
    typeof obj.teamName === "string" && obj.teamName.trim()
      ? obj.teamName.trim()
      : undefined;

  const creators: JamCreatorItem[] = Array.isArray(obj.creators)
    ? obj.creators
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === "object"))
        .map((c) => ({
          name: typeof c.name === "string" ? c.name.trim() : "",
          roles: Array.isArray(c.roles)
            ? c.roles.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
            : [],
          userId: typeof c.userId === "string" && c.userId.trim() ? c.userId.trim() : undefined,
          memberId:
            typeof c.memberId === "string" && c.memberId.trim() ? c.memberId.trim() : undefined,
          avatar: typeof c.avatar === "string" && c.avatar.trim() ? c.avatar.trim() : null,
        }))
        .filter((c) => c.name.length > 0)
    : [];

  const trophy: JamTrophyType | null = isValidJamTrophy(obj.trophy) ? obj.trophy : null;

  const sortOrder: number | null =
    typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder) && obj.sortOrder >= 0
      ? Math.floor(obj.sortOrder)
      : null;

  const isAdminPlaceholder = Boolean(obj.isAdminPlaceholder);

  const links = Array.isArray(obj.links)
    ? obj.links
        .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === "object"))
        .map((l) => ({
          label: typeof l.label === "string" ? l.label.trim() : "",
          url: typeof l.url === "string" ? l.url.trim() : "",
        }))
        .filter((l) => l.url.length > 0)
    : [];

  const tagIds = Array.isArray(obj.tagIds)
    ? obj.tagIds.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  const customTags = Array.isArray(obj.customTags)
    ? obj.customTags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  return {
    coverImage,
    teamName,
    creators,
    trophy,
    sortOrder,
    isAdminPlaceholder,
    links,
    tagIds,
    customTags,
  };
}

/**
 * 解析卡片左下角展示的队名：
 * 1. 若 metadata.teamName 显式指定则优先使用；
 * 2. 若属于常规参赛队伍（非管理员内部占位队伍），使用 team.name；
 * 3. 否则返回空字符串。
 */
export function resolveJamEntryTeamName(sub: {
  team?: { name?: string | null; topic?: string | null } | null;
  metadata?: unknown;
}): string {
  const meta = parseJamSubmissionMeta(sub.metadata);
  if (meta.teamName) return meta.teamName;
  if (
    sub.team?.name &&
    sub.team.topic !== JAM_ADMIN_ENTRY_TOPIC &&
    !meta.isAdminPlaceholder
  ) {
    return sub.team.name.trim();
  }
  return "";
}

/**
 * 将条目拆分为「排序栏」与「未排序栏」，并对排序栏自动标号 (#1, #2, #3...)
 */
export function splitJamEntriesByRank<T extends { id: string; metadata?: unknown }>(
  entries: T[]
): {
  ranked: (T & { rank: number; parsedMeta: JamSubmissionMeta })[];
  unranked: (T & { rank: null; parsedMeta: JamSubmissionMeta })[];
} {
  const withMeta = entries.map((entry) => ({
    ...entry,
    parsedMeta: parseJamSubmissionMeta(entry.metadata),
  }));

  const rankedRaw = withMeta
    .filter((item) => item.parsedMeta.sortOrder !== null)
    .sort((a, b) => {
      const orderDiff = (a.parsedMeta.sortOrder as number) - (b.parsedMeta.sortOrder as number);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });

  const ranked = rankedRaw.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const unranked = withMeta
    .filter((item) => item.parsedMeta.sortOrder === null)
    .map((item) => ({
      ...item,
      rank: null,
    }));

  return { ranked, unranked };
}

/**
 * Fisher-Yates 洗牌算法（支持注入自定义随机函数以便单测确定性断言）
 */
export function shuffleUnrankedEntries<T>(items: T[], randomFn: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const clampedJ = Math.max(0, Math.min(i, j));
    const tmp = copy[i];
    copy[i] = copy[clampedJ];
    copy[clampedJ] = tmp;
  }
  return copy;
}

/**
 * 页面展示排序：
 * 1. 置顶所有获奖作品（金奖 → 银奖 → 铜奖；同奖杯内按排序栏名次优先）；
 * 2. 紧随其后为其余在「排序栏」中的作品（按 #1, #2, #3... 排序）；
 * 3. 最后为其余在「未排序栏」中的作品（随机顺序展示）。
 */
export function sortJamSubmissionsForDisplay<T extends { id: string; metadata?: unknown }>(
  entries: T[],
  randomFn: () => number = Math.random
): (T & { rank: number | null; parsedMeta: JamSubmissionMeta })[] {
  const { ranked, unranked } = splitJamEntriesByRank(entries);

  // 未排序栏先做随机打乱
  const shuffledUnranked = shuffleUnrankedEntries(unranked, randomFn);

  // 合并后提取获奖作品置顶
  const allWithRank: (T & { rank: number | null; parsedMeta: JamSubmissionMeta })[] = [
    ...ranked,
    ...shuffledUnranked,
  ];

  const awarded = allWithRank
    .filter((item) => item.parsedMeta.trophy !== null)
    .sort((a, b) => {
      const tA = JAM_TROPHY_ORDER[a.parsedMeta.trophy!];
      const tB = JAM_TROPHY_ORDER[b.parsedMeta.trophy!];
      if (tA !== tB) return tA - tB;
      // 同等奖杯下，已排序名次优先
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return 0;
    });

  const nonAwardedRanked = ranked.filter((item) => item.parsedMeta.trophy === null);
  const nonAwardedUnranked = shuffledUnranked.filter((item) => item.parsedMeta.trophy === null);

  return [...awarded, ...nonAwardedRanked, ...nonAwardedUnranked];
}
