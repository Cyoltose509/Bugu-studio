import { Metadata } from "next";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

export const metadata: Metadata = { title: "社团历史", description: "记录布谷工作室每一年的成长与创作" };
export const revalidate = 3600; // 历史数据变化少，1小时缓存

export default async function HistoryPage() {
  const currentYear = new Date().getFullYear();

  // 从三个数据源收集所有有数据的年份
  const [projectYearRows, memberGradeRows, eventYearRows] = await Promise.all([
    prisma.project.findMany({ where: { status: ProjectStatus.PUBLISHED }, select: { developYear: true }, distinct: ["developYear"] }),
    prisma.clubMember.findMany({ select: { grade: true }, distinct: ["grade"] }),
    prisma.yearEvent.findMany({ select: { year: true }, distinct: ["year"] }),
  ]);

  // 从 grade 字段提取年份（如 "2021级" → 2021）
  const memberYearSet = new Set(
    memberGradeRows
      .filter((m) => m.grade != null)
      .map((m) => parseInt(m.grade!, 10))
      .filter((n) => !isNaN(n) && n >= 2000 && n <= currentYear)
  );

  // 合并所有年份
  const allYearsSet = new Set<number>();
  for (const p of projectYearRows) allYearsSet.add(p.developYear);
  for (const y of memberYearSet) allYearsSet.add(y);
  for (const e of eventYearRows) allYearsSet.add(e.year);

  // 兜底：确保至少检测到 2017 年
  const maxYear = allYearsSet.size > 0 ? Math.max(...allYearsSet) : currentYear;
  const minYear = allYearsSet.size > 0 ? Math.min(Math.min(...allYearsSet), 2017) : 2017;

  // 生成所有需要检查的年份（从最新到最远）
  const allYears: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    allYears.push(y);
  }

  const yearDetails = [];
  for (const year of allYears) {
    const [projects, members, events] = await Promise.all([
      prisma.project.findMany({ where: { status: ProjectStatus.PUBLISHED, developYear: year }, select: { id: true, slug: true, title: true, coverImage: true, type: true }, orderBy: { publishedAt: "desc" } }),
      prisma.clubMember.findMany({ where: { grade: { startsWith: String(year) } }, select: { id: true, displayName: true, avatar: true, user: { select: { image: true } } } }),
      prisma.yearEvent.findMany({ where: { year }, orderBy: { sortOrder: "asc" }, include: { images: { orderBy: { sortOrder: "asc" } } } }),
    ]);
    // 跳过没有任何数据的年份
    if (projects.length === 0 && members.length === 0 && events.length === 0) continue;
    yearDetails.push({ year, projects, members, events });
  }

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
                    <div className="flex flex-wrap gap-3">
                      {members.map(m => {
                        const avatarUrl = m.avatar || m.user?.image;
                        return (
                        <Link key={m.id} href={`/members/${m.id}`} className="flex items-center gap-2 text-sm hover:text-[#3388BB] transition-colors" style={{ color: "#555" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden text-white shrink-0" style={{ background: "#25547A" }}>
                            {avatarUrl ? <SafeImage src={avatarUrl} alt={m.displayName} className="w-full h-full object-cover" /> : m.displayName[0]}
                          </div>
                          {m.displayName}
                        </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {projects.length > 0 && (
                  <div className="md:col-span-2 bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: "#D0DEE8" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>作品 ({projects.length}件)</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {projects.slice(0, 12).map(p => (
                        <Link key={p.id} href={`/works/${p.slug}`} className="block w-full aspect-[4/3] rounded-md overflow-hidden border hover:border-[#3388BB] transition-colors" style={{ background: "#E6F0F8", borderColor: "#D0DEE8" }}>
                          {p.coverImage ? <SafeImage src={p.coverImage} alt={p.title} className="object-cover w-full h-full" /> : <div className="w-full h-full flex items-center justify-center"><img src="/images/logo.png" alt="" width={24} height={24} className="opacity-30" /></div>}
                        </Link>
                      ))}
                    </div>
                    {projects.length > 12 && <Link href={`/works?year=${year}`} className="text-xs hover:underline flex items-center mt-2" style={{ color: "#3388BB" }}>查看全部 {projects.length} 件 →</Link>}
                  </div>
                )}
                {events.length > 0 && (
                  <div className="md:col-span-3 bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: "#D0DEE8" }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "#555" }}>大事记</h3>
                    <div className="space-y-4">
                      {events.map(event => (
                        <div key={event.id} className="flex gap-3">
                          <div className="text-xs mt-1 shrink-0" style={{ color: "#88C232" }}>◆</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-medium" style={{ color: "#333" }}>{event.title}</div>
                              {event.eventDate && (
                                <span className="text-xs" style={{ color: "#999" }}>
                                  {new Date(event.eventDate).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                            {event.body && <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#777" }}>{event.body}</div>}
                            {event.images && event.images.length > 0 && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {event.images.map((img) => (
                                  <div key={img.id} className="relative w-20 h-14 rounded overflow-hidden border" style={{ borderColor: "#D0DEE8" }}>
                                    <SafeImage src={img.url} alt={img.altText || event.title} className="object-cover w-full h-full" />
                                  </div>
                                ))}
                              </div>
                            )}
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
