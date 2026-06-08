import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

export const metadata: Metadata = { title: "社团历史", description: "记录布谷工作室每一年的成长与创作" };
export const revalidate = 3600; // 历史数据变化少，1小时缓存

export default async function HistoryPage() {
  const yearData = await prisma.project.groupBy({ by: ["developYear"], where: { status: ProjectStatus.PUBLISHED }, _count: { id: true }, orderBy: { developYear: "desc" } });
  const years = yearData.map(y => y.developYear);
  const yearDetails = await Promise.all(years.map(async year => {
    const [projects, members, events] = await Promise.all([
      prisma.project.findMany({ where: { status: ProjectStatus.PUBLISHED, developYear: year }, select: { id: true, slug: true, title: true, coverImage: true, type: true }, orderBy: { publishedAt: "desc" } }),
      prisma.clubMember.findMany({ where: { joinYear: year }, select: { id: true, displayName: true, avatar: true } }),
      prisma.yearEvent.findMany({ where: { year }, orderBy: { sortOrder: "asc" } }),
    ]);
    return { year, projects, members, events };
  }));

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>社团历史</h1>
        <p className="mt-2" style={{ color: "#777" }}>记录每一届成员的努力与成果</p>
      </div>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 hidden md:block" style={{ background: "#D0DEE8" }} />
        <div className="space-y-16">
          {yearDetails.map(({ year, projects, members, events }) => (
            <section key={year} className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-sm font-bold shrink-0 ring-4 ring-white/30 text-white" style={{ background: "#25547A" }}>{year % 100}</div>
                <h2 className="text-2xl font-bold" style={{ color: "#E38043" }}>{year}</h2>
              </div>
              <div className="md:ml-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {members.length > 0 && (
                  <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: "#D0DEE8" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>{year} 级成员 ({members.length}人)</h3>
                    <div className="flex flex-wrap gap-2">
                      {members.map(m => (
                        <Link key={m.id} href={`/members/${m.id}`} className="flex items-center gap-1.5 text-xs hover:text-[#3388BB] transition-colors" style={{ color: "#555" }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs overflow-hidden text-white" style={{ background: "#25547A" }}>
                            {m.avatar ? <Image src={m.avatar} alt={m.displayName} width={20} height={20} /> : m.displayName[0]}
                          </div>
                          {m.displayName}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {projects.length > 0 && (
                  <div className="md:col-span-2 bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: "#D0DEE8" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>作品 ({projects.length}件)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {projects.slice(0, 4).map(p => (
                        <Link key={p.id} href={`/works/${p.slug}`} className="flex items-center gap-2 text-xs hover:text-[#3388BB] transition-colors" style={{ color: "#555" }}>
                          <div className="w-8 h-8 rounded overflow-hidden shrink-0" style={{ background: "#E6F0F8" }}>
                            {p.coverImage ? <Image src={p.coverImage} alt={p.title} width={32} height={32} className="object-cover w-full h-full" /> : <div className="w-full h-full flex items-center justify-center"><Image src="/images/logo.png" alt="" width={16} height={16} className="opacity-30" /></div>}
                          </div>
                          <span className="line-clamp-1">{p.title}</span>
                        </Link>
                      ))}
                      {projects.length > 4 && <Link href={`/works?year=${year}`} className="text-xs hover:underline flex items-center" style={{ color: "#3388BB" }}>查看全部 {projects.length} 件 →</Link>}
                    </div>
                  </div>
                )}
                {events.length > 0 && (
                  <div className="md:col-span-3 bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: "#D0DEE8" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>大事记</h3>
                    <div className="space-y-2">
                      {events.map(event => (
                        <div key={event.id} className="flex gap-3">
                          <div className="text-xs mt-0.5 shrink-0" style={{ color: "#88C232" }}>◆</div>
                          <div>
                            <div className="text-sm" style={{ color: "#333" }}>{event.title}</div>
                            {event.description && <div className="text-xs mt-0.5" style={{ color: "#777" }}>{event.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
