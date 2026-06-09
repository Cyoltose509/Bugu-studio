import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ensureDefaultTags } from "@/lib/db/tags";
import { ProjectStatus } from "@prisma/client";
import MiniLikeButton from "@/components/MiniLikeButton";
import ProjectCoverImage from "@/components/ProjectCoverImage";

export const metadata: Metadata = { title: "作品库", description: "浏览历届社员创作的所有游戏作品" };
export const revalidate = 60;

interface PageProps { searchParams: Promise<{ q?: string; type?: string; tag?: string; year?: string; page?: string; sort?: string }>; }

const TYPE_LABELS: Record<string, string> = { DEMO: "Demo 演示", STEAM: "Steam 发布", ITCH: "itch.io 发布", OTHER: "其他" };

export default async function WorksPage({ searchParams }: PageProps) {
  await ensureDefaultTags();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 12;
  const skip = (page - 1) * pageSize;
  const sort = params.sort || "date"; // date | name | likes

  const where: any = { status: ProjectStatus.PUBLISHED };
  if (params.type) where.type = params.type;
  if (params.year) where.developYear = parseInt(params.year);
  if (params.q) where.OR = [{ title: { contains: params.q, mode: "insensitive" } }, { description: { contains: params.q, mode: "insensitive" } }];
  if (params.tag) where.tags = { some: { tag: { slug: params.tag } } };

  const cacheKey = `works:list:${page}:${params.type || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}:${sort}`;

  // 根据排序方式确定 orderBy
  const orderBy: any = sort === "name"
    ? [{ title: "asc" }]
    : sort === "likes"
    ? [{ likes: { _count: "desc" } }, { publishedAt: "desc" }]
    : [{ isFeatured: "desc" }, { publishedAt: "desc" }];

  const [tags, projects, total, years] = await Promise.all([
    cachedQuery('works:sidebar:tags', () =>
      prisma.tag.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { projects: { where: { project: { status: "PUBLISHED" } } } } } } })
    , 120),
    cachedQuery(cacheKey, () =>
      prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          tags: { include: { tag: true } },
          members: {
            take: 3,
            include: {
              member: {
                select: {
                  displayName: true,
                  avatar: true,
                  user: { select: { image: true } },
                },
              },
            },
          },
          _count: { select: { likes: true } },
        },
      })
    , 60),
    params.q || params.tag
      ? prisma.project.count({ where })
      : cachedQuery('works:total', () => prisma.project.count({ where }), 60),
    cachedQuery('works:sidebar:years', () =>
      prisma.project.groupBy({ by: ["developYear"], where: { status: ProjectStatus.PUBLISHED }, orderBy: { developYear: "desc" } })
    , 120),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>作品库</h1>
        <p style={{ color: "#777" }} className="mt-2">共 {total} 件作品</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
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
        <div className="flex-1">
          <form className="mb-4 flex items-center gap-3">
            <input type="search" name="q" defaultValue={params.q} placeholder="搜索作品名称或简介..." className="flex-1 bg-white border rounded-lg px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent" style={{ borderColor: "#D0DEE8", color: "#333" }} />
            <SortToggle currentSort={sort} currentParams={params} />
          </form>
          {projects.length === 0 ? (
            <div className="text-center py-20" style={{ color: "#999" }}><div className="text-4xl mb-4">🔍</div><p>没有找到匹配的作品</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {projects.map((p, idx) => (
                <Link key={p.id} href={`/works/${p.slug}`} className="game-card group bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md" style={{ borderColor: "#D0DEE8" }}>
                  <div className="relative aspect-video" style={{ background: "#E6F0F8" }}>
                    <ProjectCoverImage
                      src={p.coverImage}
                      alt={p.title}
                      priority={idx === 0}
                    />
                    {!p.coverImage && (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "#E6F0F8" }}>
                        <img src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2"><span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">{TYPE_LABELS[p.type]}</span></div>
                    {p.isFeatured && <div className="absolute top-2 right-2"><span className="text-xs px-2 py-0.5 rounded text-white" style={{ background: "#E38043" }}>精选</span></div>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold group-hover:text-[#3388BB] transition-colors line-clamp-1" style={{ color: "#333" }}>{p.title}</h3>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>{p.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {p.tags.slice(0, 3).map(({ tag }) => <span key={tag.slug} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232" }}>{tag.name}</span>)}
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs" style={{ color: "#999" }}>{p.developYear}</span>
                      <div className="flex items-center gap-2">
                        <MiniLikeButton projectId={p.id} initialCount={p._count.likes} />
                        <div className="flex -space-x-1">
                          {p.members.slice(0, 3).map((pm) => {
                            const name = pm.member?.displayName || pm.externalName || "?";
                            const avatarUrl = pm.member ? (pm.member.user?.image || pm.member.avatar) : null;
                            return (
                              <div key={pm.id} className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white border border-white overflow-hidden"
                                style={{ background: pm.member ? "#E38043" : "#6B7280" }}
                                title={name}>
                                {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : name[0]}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
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
        </div>
      </div>
    </div>
  );
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
