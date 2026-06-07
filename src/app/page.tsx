/**
 * 首页 - 布谷工作室
 */
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus, ProjectType } from "@prisma/client";

export const metadata: Metadata = { title: "首页" };
export const dynamic = "force-dynamic";
export const revalidate = 60;

async function getStats() {
  const foundedYear = parseInt(process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2018");
  const [memberCount, projectCount, steamCount] = await Promise.all([
    prisma.clubMember.count(),
    prisma.project.count({ where: { status: ProjectStatus.PUBLISHED } }),
    prisma.project.count({ where: { status: ProjectStatus.PUBLISHED, type: ProjectType.STEAM } }),
  ]);
  return { foundedYear, memberCount, projectCount, steamCount };
}

async function getFeaturedProjects() {
  return prisma.project.findMany({
    where: { status: ProjectStatus.PUBLISHED, isFeatured: true },
    orderBy: { publishedAt: "desc" }, take: 6,
    include: { tags: { include: { tag: true } }, members: { take: 3, include: { member: { select: { displayName: true, avatar: true } } } } },
  });
}

async function getLatestProjects() {
  return prisma.project.findMany({
    where: { status: ProjectStatus.PUBLISHED },
    orderBy: { publishedAt: "desc" }, take: 4,
    include: { tags: { include: { tag: true } }, members: { take: 3, include: { member: { select: { displayName: true, avatar: true } } } } },
  });
}

export default async function HomePage() {
  const [stats, featuredProjects, latestProjects] = await Promise.all([getStats(), getFeaturedProjects(), getLatestProjects()]);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28 text-center" style={{ background: "linear-gradient(180deg, #E6F0F8 0%, #D0E4F0 100%)" }}>
        <div className="container mx-auto max-w-3xl relative">
          <Image src="/images/logo.png" alt="布谷工作室" width={96} height={96} className="mx-auto mb-6 rounded-xl shadow-lg" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: "#25547A" }}>布谷工作室</h1>
          <p className="text-xl mb-3" style={{ color: "#555" }}>成立于 {stats.foundedYear} 年 · 作品档案馆</p>
          <p className="mb-8 max-w-xl mx-auto" style={{ color: "#777" }}>
            我们是一群热爱游戏开发的同学，用代码和创意共同构建虚拟世界。这里存档了历届社员的每一份作品与心血。
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/works" className="btn-primary px-6 py-3 rounded-lg font-medium text-sm">浏览作品</Link>
            <Link href="/members" className="btn-secondary px-6 py-3 rounded-lg font-medium text-sm">认识成员</Link>
          </div>
        </div>
      </section>

      {/* 统计数据 */}
      <section className="py-10 border-y" style={{ borderColor: "#D0DEE8", background: "rgba(255,255,255,0.6)" }}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <Stat value={`${new Date().getFullYear() - stats.foundedYear + 1}年`} label="社团历史" />
            <Stat value={`${stats.memberCount}+`} label="历届成员" />
            <Stat value={`${stats.projectCount}+`} label="累计作品" />
            <Stat value={`${stats.steamCount}`} label="Steam 发布" />
          </div>
        </div>
      </section>

      {/* 精选作品 */}
      {featuredProjects.length > 0 && (
        <section className="py-16 container mx-auto px-4">
          <SectionHeader title="精选作品" href="/works" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {featuredProjects.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        </section>
      )}

      {/* 最新作品 */}
      <section className="py-16 container mx-auto px-4">
        <SectionHeader title="最新作品" href="/works" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {latestProjects.map(p => <ProjectCard key={p.id} project={p} compact />)}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-4 max-w-xl">
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#25547A" }}>想加入我们？</h2>
          <p className="mb-6" style={{ color: "#777" }}>每学年开放招新，欢迎对游戏开发充满热情的同学加入。</p>
          <Link href="/join" className="btn-primary inline-block px-8 py-3 rounded-lg font-medium text-sm">了解招新信息</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold" style={{ color: "#E38043" }}>{value}</div>
      <div className="text-sm mt-1" style={{ color: "#777" }}>{label}</div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold" style={{ color: "#25547A" }}>{title}</h2>
      <Link href={href} className="text-sm hover:underline" style={{ color: "#3388BB" }}>查看全部 →</Link>
    </div>
  );
}

type ProjectWithRelations = Awaited<ReturnType<typeof getFeaturedProjects>>[0];

function ProjectCard({ project, compact = false }: { project: ProjectWithRelations; compact?: boolean }) {
  const typeLabel: Record<string, string> = { STEAM: "Steam", INDIE: "独立游戏", GAME_JAM: "Game Jam", DEMO: "Demo", PROTOTYPE: "原型", GRADUATION: "毕业设计", OTHER: "其他" };

  return (
    <Link href={`/works/${project.slug}`} className="game-card group block bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md" style={{ borderColor: "#D0DEE8" }}>
      <div className={`relative w-full bg-gray-100 ${compact ? "aspect-video" : "aspect-video"}`}>
        {project.coverImage ? <Image src={project.coverImage} alt={project.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width:768px) 100vw,33vw" /> : <div className="w-full h-full flex items-center justify-center"><Image src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" /></div>}
        <div className="absolute top-2 left-2"><span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">{typeLabel[project.type] || project.type}</span></div>
      </div>
      <div className="p-4">
        <h3 className={`font-semibold group-hover:text-[#3388BB] transition-colors ${compact ? "text-sm" : "text-base"}`} style={{ color: "#333" }}>{project.title}</h3>
        {!compact && <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>{project.description}</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {project.tags.slice(0, 3).map(({ tag }) => (
            <span key={tag.slug} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#88C23222", color: "#88C232" }}>{tag.name}</span>
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: "#999" }}>{project.developYear}</div>
      </div>
    </Link>
  );
}
