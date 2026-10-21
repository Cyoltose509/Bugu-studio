/**
 * Local frontend mock (no DB): reads fixtures/frontend-mock.json
 * Enable: USE_MOCK_DATA=1 in .env.local
 */
import fs from "fs";
import path from "path";
import { nameSortKey } from "@/lib/works/name-sort";
import { compareProjectsByDate } from "@/lib/works/date-sort";
import { extractAwardYear, groupAwardsByYear } from "@/lib/history/awards";
import { compareActivitiesNewestFirst } from "@/lib/activities/datetime";

export type MockSnapshot = {
  fetchedAt: string;
  source: string;
  projects: any[];
  tags: any[];
  years: { developYear: number }[];
  members?: any[];
  activities?: any[];
  yearEvents?: any[];
  historyYears?: any[];
  stats: {
    memberCount: number;
    projectCount: number;
    releasedCount: number;
  };
  mockUserHints?: {
    defaultMemberId?: string;
    defaultMemberName?: string;
  };
};

let cached: MockSnapshot | null = null;

export function isMockDataEnabled(): boolean {
  return process.env.USE_MOCK_DATA === "1" || process.env.USE_MOCK_DATA === "true";
}

export function getMockSnapshot(): MockSnapshot {
  if (cached) return cached;
  const file = path.join(process.cwd(), "fixtures", "frontend-mock.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      "缺少 fixtures/frontend-mock.json，请先生成：node scripts/assemble-mock-fixture.mjs 或 node scripts/fetch-mock-from-prod.mjs",
    );
  }
  cached = JSON.parse(fs.readFileSync(file, "utf8")) as MockSnapshot;
  return cached;
}

/** 清掉内存里的 fixture 缓存（测试里换 fixture 时用它） */
export function clearMockSnapshotCache() {
  cached = null;
}

function matchesFilters(
  p: any,
  filters: {
    types?: string | null;
    year?: string | null;
    tag?: string | null;
    q?: string | null;
  },
) {
  if (filters.types) {
    const list = filters.types.split(",").filter(Boolean).map((t) => {
      if (t === "STEAM") return "OFFICIAL_RELEASE";
      if (t === "DEMO" || t === "ITCH") return "TRIAL_DEMO";
      return t;
    });
    if (list.length && !list.includes(p.type)) return false;
  }
  if (filters.year && String(p.developYear) !== String(filters.year)) return false;
  if (filters.tag) {
    const has = (p.tags || []).some((t: any) => t.tag?.slug === filters.tag);
    if (!has) return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const hay = `${p.title || ""} ${p.subtitle || ""} ${p.description || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortProjects(list: any[], sort: string) {
  const arr = [...list];
  if (sort === "name") {
    // 与真实数据一致：中文按拼音、英文原名优先，统一字母序混排
    arr.sort(
      (a, b) =>
        nameSortKey(String(a.title), a.subtitle ?? null).localeCompare(
          nameSortKey(String(b.title), b.subtitle ?? null),
        ) || String(b.id).localeCompare(String(a.id)),
    );
  } else if (sort === "likes") {
    arr.sort(
      (a, b) =>
        (b._count?.likes ?? 0) - (a._count?.likes ?? 0) ||
        String(b.id).localeCompare(String(a.id)),
    );
  } else {
    arr.sort(compareProjectsByDate);
  }
  return arr;
}

function withDates<T extends Record<string, any>>(obj: T, keys: string[]): T {
  const out: any = { ...obj };
  for (const k of keys) {
    if (out[k]) out[k] = new Date(out[k]);
  }
  return out;
}

export function mockListProjects(opts: {
  types?: string | null;
  year?: string | null;
  tag?: string | null;
  q?: string | null;
  sort?: string | null;
  cursor?: string | null;
  take?: number;
}) {
  const snap = getMockSnapshot();
  const sort = opts.sort || "date";
  const take = opts.take ?? 16;
  let list = sortProjects(
    snap.projects.filter((p) => matchesFilters(p, opts)),
    sort,
  );

  if (opts.cursor) {
    const idx = list.findIndex((p) => p.id === opts.cursor);
    list = idx >= 0 ? list.slice(idx + 1) : list;
  }

  const page = list.slice(0, take + 1);
  const hasMore = page.length > take;
  const items = hasMore ? page.slice(0, take) : page;
  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    total: snap.projects.filter((p) => matchesFilters(p, opts)).length,
  };
}

export function mockLatestProjects(take = 8) {
  return mockListProjects({ sort: "date", take }).items;
}

export function mockStats() {
  return getMockSnapshot().stats;
}

/** 管理员面板概览：离线（数据库连不上）时的兜底数据，结构与真实接口一致 */
export function mockAdminDashboard() {
  const snap = getMockSnapshot();
  const projects = [...(snap.projects || [])].sort(
    (a, b) =>
      new Date(b.createdAt || b.publishedAt || 0).getTime() -
      new Date(a.createdAt || a.publishedAt || 0).getTime(),
  );
  const members = [...(snap.members || [])];
  const pendingCount = projects.filter((p) => p.status === "PENDING").length;

  return {
    userCount: members.length,
    memberCount: snap.stats?.memberCount ?? members.length,
    projectCount: snap.stats?.projectCount ?? projects.length,
    pendingCount,
    latestUsers: members.slice(0, 5).map((m, i) => ({
      id: m.userId || m.user?.id || m.id || `mock-u-${i}`,
      name: m.displayName || m.user?.name || "匿名",
      email: m.user?.email || "-",
      role: (m.user?.role as string) || "MEMBER",
      createdAt: new Date(m.createdAt || Date.now()),
    })),
    latestProjects: projects.slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title || "未命名作品",
      status: p.status || "PUBLISHED",
      createdAt: new Date(p.createdAt || p.publishedAt || Date.now()),
    })),
    offline: true as const,
  };
}

export function mockSidebarTags() {
  const snap = getMockSnapshot();
  const counts = new Map<string, number>();
  for (const p of snap.projects) {
    for (const pt of p.tags || []) {
      const slug = pt.tag?.slug;
      if (slug) counts.set(slug, (counts.get(slug) || 0) + 1);
    }
  }
  return snap.tags.map((t) => ({
    ...t,
    _count: { projects: counts.get(t.slug) || 0 },
  }));
}

export function mockSidebarYears() {
  return getMockSnapshot().years;
}

export function mockProjectBySlug(slug: string) {
  return getMockSnapshot().projects.find((p) => p.slug === slug) ?? null;
}

export function mockAdjacentProjects(slug: string, sort = "date") {
  const list = sortProjects(getMockSnapshot().projects, sort);
  const idx = list.findIndex((p) => p.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;
  return {
    prev: prev ? { slug: prev.slug, title: prev.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  };
}

export function mockHomeActivities(take = 6) {
  const list = getMockSnapshot().activities || [];
  const now = Date.now();
  const dated = list.map((a) => withDates(a, ["startTime", "endTime", "themeRevealedAt"]));
  const live = dated
    .filter((a) => a.status === "PUBLISHED" && (a.timePending || a.endTime.getTime() >= now))
    .sort(compareActivitiesNewestFirst)
    .slice(0, Math.min(3, take));
  const past = dated
    .filter((a) => !a.timePending && (a.status === "ARCHIVED" || a.endTime.getTime() < now))
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
    .slice(0, Math.max(0, take - live.length));
  return [...live, ...past];
}

export function mockActivitiesBuckets() {
  const now = Date.now();
  const list = (getMockSnapshot().activities || []).map((a) =>
    withDates({ ...a }, ["startTime", "endTime", "themeRevealedAt"]),
  );
  const ongoing = list
    .filter((a) => a.status === "PUBLISHED" && !a.timePending && a.startTime.getTime() <= now && a.endTime.getTime() >= now)
    .sort(compareActivitiesNewestFirst)
    .slice(0, 6);
  const upcoming = list
    .filter((a) => a.status === "PUBLISHED" && (a.timePending || a.startTime.getTime() > now))
    .sort(compareActivitiesNewestFirst)
    .slice(0, 6);
  const past = list
    .filter(
      (a) =>
        !a.timePending && (
          (a.status === "PUBLISHED" && a.endTime.getTime() < now) ||
          a.status === "ARCHIVED"
        ),
    )
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
    .slice(0, 12);
  return [ongoing, upcoming, past] as const;
}

export function mockActivityByKey(key: string) {
  const list = getMockSnapshot().activities || [];
  const raw =
    list.find((a) => a.id === key) ||
    list.find((a) => a.slug === key) ||
    null;
  if (!raw) return null;
  return withDates(
    {
      ...raw,
      proposals: raw.proposals || [],
      talks: raw.talks || [],
      jamTeams: raw.jamTeams || [],
      jamJudges: raw.jamJudges || [],
      jamSubmissions: raw.jamSubmissions || [],
    },
    ["startTime", "endTime", "themeRevealedAt"],
  );
}

export function mockResolveActivityId(key: string): string | null {
  const a = mockActivityByKey(key);
  return a?.id ?? null;
}

export function mockMembersList() {
  return [...(getMockSnapshot().members || [])].sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (so) return so;
    const y = (b.joinYear ?? 0) - (a.joinYear ?? 0);
    if (y) return y;
    return String(a.displayName).localeCompare(String(b.displayName), "zh");
  });
}

export function mockMemberById(id: string) {
  const m = (getMockSnapshot().members || []).find((x) => x.id === id);
  if (!m) return null;
  const projects = getMockSnapshot().projects.filter((p) =>
    (p.members || []).some((pm: any) => pm.memberId === id || pm.member?.id === id),
  );
  return {
    ...m,
    socialLinks: m.socialLinks || [],
    workExperiences: m.workExperiences || [],
    projectMembers: projects.map((p, i) => ({
      id: `${id}-pm-${i}`,
      project: p,
      roles: (p.members || []).find((pm: any) => pm.memberId === id || pm.member?.id === id)?.roles || [],
      sortOrder: i,
    })),
  };
}

export function mockYearEvents() {
  return (getMockSnapshot().yearEvents || []).map((e) =>
    withDates({ ...e, images: e.images || [] }, ["eventDate", "eventEndDate", "createdAt", "updatedAt"]),
  );
}

/** /history 年份详情：把 fixture 里的成员/作品/大事记拼成年度数据 */
export function mockHistoryYearDetails() {
  const snap = getMockSnapshot();
  const members = snap.members || [];
  const projects = snap.projects || [];
  const events = mockYearEvents();
  const activities = (snap.activities || []).map((a) =>
    withDates({ ...a }, ["startTime", "endTime"]),
  );

  const years = new Set<number>();
  for (const p of projects) if (p.developYear) years.add(p.developYear);
  for (const m of members) {
    if (m.grade) years.add(m.grade);
    if (m.joinYear) years.add(m.joinYear);
  }
  for (const e of events) years.add(e.year);
  for (const a of activities) if (a.startTime && !a.timePending) years.add(new Date(a.startTime).getFullYear());
  // 奖项文本里的年份也纳入年份集合
  for (const p of projects) {
    for (const award of (p.awards || [])) {
      const y = extractAwardYear(award);
      if (y) years.add(y);
    }
  }

  const START_YEAR = 2019;
  const currentYear = new Date().getFullYear();
  const maxYear = years.size ? Math.max(...years) : currentYear;
  const minYear = Math.max(START_YEAR, years.size ? Math.min(...years) : START_YEAR);

  const awardByYear = groupAwardsByYear(projects);
  const details: any[] = [];
  for (let year = maxYear; year >= minYear; year--) {
    const yearProjects = projects.filter((p) => p.developYear === year);
    const newBlood = members.filter((m) => m.joinYear === year);
    const yearEvents = events.filter((e) => e.year === year);
    const yearActivities = activities.filter(
      (a) => !!a.startTime && !a.timePending && new Date(a.startTime).getFullYear() === year,
    );
    const yearAwards = awardByYear.get(year) || [];
    if (
      !yearProjects.length &&
      !newBlood.length &&
      !yearEvents.length &&
      !yearActivities.length &&
      !yearAwards.length
    ) {
      continue;
    }

    const contrib = new Map<string, number>();
    for (const p of yearProjects) {
      for (const pm of p.members || []) {
        const mid = pm.memberId || pm.member?.id;
        if (mid) contrib.set(mid, (contrib.get(mid) || 0) + 1);
      }
    }
    const activeMembers = [...contrib.entries()]
      .map(([memberId, projectsCount]) => {
        const member = members.find((m) => m.id === memberId);
        return member
          ? {
              ...member,
              score: projectsCount,
              projects: projectsCount,
              competitions: 0,
              courses: 0,
              meetings: 0,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    const presidents = members.filter(
      (m) =>
        m.grade != null &&
        m.grade === year - 2 &&
        ["PRESIDENT", "VICE_PRESIDENT", "PAST_PRESIDENT", "PAST_VICE_PRESIDENT", "FOUNDER"].includes(
          m.position || "",
        ),
    );

    details.push({
      year,
      projects: yearProjects,
      members: newBlood,
      events: yearEvents,
      activities: yearActivities,
      activeMembers,
      presidents,
      awards: yearAwards,
    });
  }

  return { yearDetails: details, startYear: START_YEAR };
}

/** 假登录用户：按 MOCK_USER_EMAIL / MOCK_MEMBER_ID 从 fixture 里取出对应用户 */
export function getMockAuthUser() {
  if (!isMockDataEnabled()) return null;
  const email = (process.env.MOCK_USER_EMAIL || "").trim().toLowerCase();
  if (!email) return null;
  const snap = getMockSnapshot();
  const memberId =
    process.env.MOCK_MEMBER_ID || snap.mockUserHints?.defaultMemberId || null;
  const member = memberId
    ? (snap.members || []).find((m) => m.id === memberId)
    : null;
  const name =
    process.env.MOCK_USER_NAME ||
    member?.displayName ||
    snap.mockUserHints?.defaultMemberName ||
    "Mock User";
  const role = (process.env.MOCK_USER_ROLE || "ADMIN").toUpperCase();
  const id = process.env.MOCK_USER_ID || `mock-user-${email.replace(/[^a-z0-9]/gi, "")}`;
  return {
    id,
    email,
    name,
    image: member?.avatar || member?.user?.image || null,
    role,
    memberId: member?.id || null,
    password: process.env.MOCK_USER_PASSWORD || "",
  };
}

export function verifyMockLogin(email: string, password: string) {
  const user = getMockAuthUser();
  if (!user?.password) return null;
  if (email.trim().toLowerCase() !== user.email) return null;
  if (password !== user.password) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    memberId: user.memberId,
  };
}
