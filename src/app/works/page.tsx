/**
 * 作品库页面
 * 支持搜索、标签筛选、分类浏览
 */

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "作品库",
  description: "浏览历届社员创作的所有游戏作品",
};

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    tag?: string;
    year?: string;
    page?: string;
  }>;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  STEAM: "Steam",
  INDIE: "独立游戏",
  GAME_JAM: "Game Jam",
  DEMO: "Demo",
  PROTOTYPE: "原型",
  GRADUATION: "毕业设计",
  OTHER: "其他",
};

export default async function WorksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 12;
  const skip = (page - 1) * pageSize;

  const [tags, projects, total] = await Promise.all([
    // 获取所有标签
    prisma.tag.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { projects: { where: { project: { status: "PUBLISHED" } } } },
        },
      },
    }),
    // 获取作品列表
    prisma.project.findMany({
      where: {
        status: ProjectStatus.PUBLISHED,
        ...(params.type && { type: params.type as any }),
        ...(params.year && { developYear: parseInt(params.year) }),
        ...(params.q && {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }),
        ...(params.tag && {
          tags: { some: { tag: { slug: params.tag } } },
        }),
      },
      skip,
      take: pageSize,
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      include: {
        tags: { include: { tag: true } },
        members: {
          take: 3,
          include: { member: { select: { displayName: true, avatar: true } } },
        },
      },
    }),
    // 总数
    prisma.project.count({
      where: {
        status: ProjectStatus.PUBLISHED,
        ...(params.type && { type: params.type as any }),
        ...(params.year && { developYear: parseInt(params.year) }),
        ...(params.q && {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }),
        ...(params.tag && {
          tags: { some: { tag: { slug: params.tag } } },
        }),
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // 获取可用年份
  const years = await prisma.project.groupBy({
    by: ["developYear"],
    where: { status: ProjectStatus.PUBLISHED },
    orderBy: { developYear: "desc" },
  });

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">作品库</h1>
        <p className="text-gray-400 mt-2">共 {total} 件作品</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 侧边栏过滤器 */}
        <aside className="lg:w-56 shrink-0">
          <FilterPanel
            tags={tags}
            years={years.map((y) => y.developYear)}
            currentParams={params}
          />
        </aside>

        {/* 作品网格 */}
        <div className="flex-1">
          {/* 搜索框 */}
          <form className="mb-6">
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="搜索作品名称或简介..."
              className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </form>

          {projects.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <div className="text-4xl mb-4">🔍</div>
              <p>没有找到匹配的作品</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/works/${project.slug}`}
                  className="game-card group bg-gray-900 rounded-xl overflow-hidden border border-white/10 hover:border-indigo-500/50"
                >
                  <div className="relative aspect-video bg-gray-800">
                    {project.coverImage ? (
                      <Image
                        src={project.coverImage}
                        alt={project.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎮
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    {project.isFeatured && (
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-amber-500/80 text-white px-2 py-0.5 rounded">
                          精选
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {project.tags.slice(0, 3).map(({ tag }) => (
                        <span
                          key={tag.slug}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${tag.color}22`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-gray-500">
                        {project.developYear}
                      </span>
                      <div className="flex -space-x-1">
                        {project.members.slice(0, 3).map(({ member }) => (
                          <div
                            key={member.displayName}
                            className="w-5 h-5 rounded-full bg-indigo-600 border border-gray-900 flex items-center justify-center text-xs"
                            title={member.displayName}
                          >
                            {member.avatar ? (
                              <Image
                                src={member.avatar}
                                alt={member.displayName}
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            ) : (
                              member.displayName[0]
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {page > 1 && (
                <Link
                  href={buildUrl(params, { page: page - 1 })}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
                >
                  上一页
                </Link>
              )}
              <span className="px-4 py-2 text-gray-400 text-sm">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl(params, { page: page + 1 })}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
                >
                  下一页
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 侧边栏过滤组件
// ============================================================

type Tag = { slug: string; name: string; color: string; _count: { projects: number } };

function FilterPanel({
  tags,
  years,
  currentParams,
}: {
  tags: Tag[];
  years: number[];
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <div className="space-y-6">
      {/* 类型筛选 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">类型</h3>
        <div className="space-y-1.5">
          <FilterLink
            href={buildUrl(currentParams, { type: undefined, page: 1 })}
            active={!currentParams.type}
            label="全部"
          />
          {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
            <FilterLink
              key={value}
              href={buildUrl(currentParams, { type: value, page: 1 })}
              active={currentParams.type === value}
              label={label}
            />
          ))}
        </div>
      </div>

      {/* 年份筛选 */}
      {years.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">年份</h3>
          <div className="space-y-1.5">
            <FilterLink
              href={buildUrl(currentParams, { year: undefined, page: 1 })}
              active={!currentParams.year}
              label="全部年份"
            />
            {years.map((year) => (
              <FilterLink
                key={year}
                href={buildUrl(currentParams, { year: String(year), page: 1 })}
                active={currentParams.year === String(year)}
                label={String(year)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 标签筛选 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">标签</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={buildUrl(currentParams, {
                tag: currentParams.tag === tag.slug ? undefined : tag.slug,
                page: 1,
              })}
              className={`text-xs px-2 py-1 rounded transition-all ${
                currentParams.tag === tag.slug
                  ? "ring-1 ring-offset-1 ring-offset-gray-950"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={{
                backgroundColor: `${tag.color}22`,
                color: tag.color,
                ...(currentParams.tag === tag.slug && { ringColor: tag.color }),
              }}
            >
              {tag.name} ({tag._count.projects})
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`block text-sm px-3 py-1.5 rounded transition-colors ${
        active
          ? "bg-indigo-600/20 text-indigo-300"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/works${qs ? `?${qs}` : ""}`;
}
