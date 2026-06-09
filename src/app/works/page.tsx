import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ensureDefaultTags } from "@/lib/db/tags";
import { auth } from "@/lib/auth/auth";
import { ProjectStatus } from "@prisma/client";
import StaggeredCard from "@/components/works/StaggeredCard";
import LogoLoading from "@/components/ui/LogoLoading";

export const metadata: Metadata = { title: "作品库", description: "浏览历届社员创作的所有游戏作品" };
export const revalidate = 60;

interface PageProps { searchParams: Promise<{ q?: string; type?: string; tag?: string; year?: string; page?: string; sort?: string }>; }

const TYPE_LABELS: Record<string, string> = { DEMO: "Demo 演示", STEAM: "Steam 发布", ITCH: "itch.io 发布", OTHER: "其他" };

export default async function WorksPage({ searchParams }: PageProps) {
  await ensureDefaultTags();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  // 侧栏数据（立即渲染，有长 TTL 缓存）
  const [tags, total, years] = await Promise.all([
    cachedQuery('works:sidebar:tags', () =>
      prisma.tag.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { projects: { where: { project: { status: "PUBLISHED" } } } } } } })
    , 120),
    (params.q || params.tag)
      ? prisma.project.count({ where: buildWhere(params) })
      : cachedQuery('works:total', () => prisma.project.count({ where: buildWhere(params) }), 300),
    cachedQuery('works:sidebar:years', () =>
      prisma.project.groupBy({ by: ["developYear"], where: { status: ProjectStatus.PUBLISHED }, orderBy: { developYear: "desc" } })
    , 120),
  ]);

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>作品库</h1>
        <p style={{ color: "#777" }} className="mt-2">共 {total} 件作品</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* 侧栏 — 立即渲染 */}
        <aside className="lg:w-56 shrink-0">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>类型</h3>
              <div className="space-y-1.5">
                <FilterLink href={buildUrl(params, { type: void 0, page: 1 })} active={!params.type} label="全部" />
                {Object.entries(TYPE_LABELS).map(([v, l]) => <FilterLink key={v} href={buildUrl(params, { type: v, page: 1 })} active={params.type === v} label={l} />)}
              </div>
            </div>
            {years.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>年份</h3>
                <div className="space-y-1.5">
                  <FilterLink href={buildUrl(params, { year: void 0, page: 1 })} active={!params.year} label="全部年份" />
                  {years.map(y => <FilterLink key={y.developYear} href={buildUrl(params, { year: String(y.developYear), page: 1 })} active={params.year === String(y.developYear)} label={String(y.developYear)} />)}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>标签</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Link key={tag.slug} href={buildUrl(params, { tag: params.tag === tag.slug ? void 0 : tag.slug, page: 1 })} className={`text-xs px-2 py-1 rounded transition-all ${params.tag === tag.slug ? "ring-1 ring-[#88C232] ring-offset-1 ring-offset-[#F0F5F9]" : "opacity-70 hover:opacity-100"}`} style={{ backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232" }}>
                    {tag.name} ({tag._count.projects})
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 主区域 — 搜索框立即显示，作品网格流式加载 */}
        <div className="flex-1">
          <form className="mb-4 flex items-center gap-3">
            <input type="search" name="q" defaultValue={params.q} placeholder="搜索作品名称或简介..." className="flex-1 bg-white border rounded-lg px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent" style={{ borderColor: "#D0DEE8", color: "#333" }} />
            <SortToggle currentSort={params.sort || "date"} currentParams={params} />
          </form>

          <Suspense fallback={<LogoLoading text="正在加载作品..." />}>
            <WorksGrid params={params} page={page} total={total} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/** 作品网格 — 数据库查询较慢，Suspense 流式加载 */
async function WorksGrid({ params, page, total }: { params: Record<string, any>; page: number; total: number }) {
  const pageSize = 12;
  const skip = (page - 1) * pageSize;
  const sort = params.sort || "date";

  const cacheKey = `works:list:${page}:${params.type || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}:${sort}`;

  const orderBy: any = sort === "name"
    ? [{ title: "asc" }]
    : sort === "likes"
    ? [{ likes: { _count: "desc" } }, { publishedAt: "desc" }]
    : [{ isFeatured: "desc" }, { publishedAt: "desc" }];

  const where = buildWhere(params);

  const projects = await cachedQuery(cacheKey, () =>
    prisma.project.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        tags: { include: { tag: true } },
        _count: { select: { likes: true } },
      },
    })
  , 120);

  // 批量查询点赞状态
  const session = await auth().catch(() => null);
  let likedProjectIds = new Set<string>();
  if (session?.user?.id && projects.length > 0) {
    const liked = await prisma.projectLike.findMany({
      where: { projectId: { in: projects.map((p) => p.id) }, userId: session.user.id },
      select: { projectId: true },
    });
    likedProjectIds = new Set(liked.map((l) => l.projectId));
  }

  // 批量查询 members
  let membersMap = new Map<string, any[]>();
  if (projects.length > 0) {
    const allMembers = await prisma.projectMember.findMany({
      where: { projectId: { in: projects.map(p => p.id) } },
      include: { member: { select: { displayName: true, avatar: true, user: { select: { image: true } } } } },
      orderBy: { sortOrder: "asc" },
    });
    for (const pm of allMembers) {
      const arr = membersMap.get(pm.projectId) || [];
      if (arr.length < 3) arr.push(pm);
      membersMap.set(pm.projectId, arr);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      {projects.length === 0 ? (
        <div className="text-center py-20" style={{ color: "#999" }}>
          <div className="text-4xl mb-4">🔍</div>
          <p>没有找到匹配的作品</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {projects.map((p, idx) => (
            <StaggeredCard
              key={p.id}
              project={p}
              members={membersMap.get(p.id) || []}
              idx={idx}
              liked={likedProjectIds.has(p.id)}
              typeLabels={TYPE_LABELS}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {page > 1 && <Link href={buildUrl(params, { page: page - 1 })} className="btn-secondary px-4 py-2 rounded-lg text-sm">上一页</Link>}
          <span className="px-4 py-2 text-sm" style={{ color: "#777" }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={buildUrl(params, { page: page + 1 })} className="btn-secondary px-4 py-2 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </>
  );
}

function buildWhere(params: Record<string, any>) {
  const where: any = { status: ProjectStatus.PUBLISHED };
  if (params.type) where.type = params.type;
  if (params.year) where.developYear = parseInt(params.year);
  if (params.q) where.OR = [{ title: { contains: params.q, mode: "insensitive" } }, { description: { contains: params.q, mode: "insensitive" } }];
  if (params.tag) where.tags = { some: { tag: { slug: params.tag } } };
  return where;
}

function SortToggle({ currentSort, currentParams }: { currentSort: string; currentParams: Record<string, any> }) {
  const sorts = [
    { value: "date", label: "时间" },
    { value: "name", label: "名称" },
    { value: "likes", label: "喜欢" },
  ];
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs mr-1" style={{ color: "#999" }}>排序:</span>
      {sorts.map((s) => {
        const isActive = currentSort === s.value;
        return (
          <Link
            key={s.value}
            href={buildUrl(currentParams, { sort: s.value !== "date" ? s.value : void 0, page: 1 })}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              background: isActive ? "#E38043" : "transparent",
              color: isActive ? "#fff" : "#999",
              border: isActive ? "none" : "1px solid #D0DEE8",
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`block text-sm px-3 py-1.5 rounded transition-colors ${active ? "font-medium" : ""}`} style={active ? { background: "rgba(37,84,122,0.07)", color: "#25547A" } : { color: "#777" }}>
      {label}
    </Link>
  );
}

function buildUrl(current: Record<string, any>, overrides: Record<string, any>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) { if (v !== void 0 && v !== null && v !== "") params.set(k, String(v)); }
  const qs = params.toString();
  return `/works${qs ? `?${qs}` : ""}`;
}
