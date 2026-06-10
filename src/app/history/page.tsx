import {Metadata} from "next";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus, ActivityType, ActivityStatus} from "@prisma/client";

export const metadata: Metadata = {title: "社团历史", description: "记录布谷工作室每一年的成长与创作"};
export const dynamic = "force-dynamic"; // 避免构建时并发连接池耗尽

const TYPE_LABELS: Record<string, string> = {
    MEETING: "例会", COURSE: "公开课", COMPETITION: "比赛", GENERAL: "普通活动",
};

const TYPE_GRADIENTS: Record<string, [string, string]> = {
    DEMO: ["#25547A", "#3388BB"],
    STEAM: ["#1a4d2e", "#2d8a4e"],
    ITCH: ["#8b3a3a", "#c05050"],
    OTHER: ["#4a4a6a", "#6a6a8a"],
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
    DEMO: "Demo", STEAM: "Steam", ITCH: "itch.io", OTHER: "其他",
};

export default async function HistoryPage() {
    const currentYear = new Date().getFullYear();

    // 从四个数据源收集所有有数据的年份（历史数据几乎不变，缓存1小时）
    const [projectYearRows, memberGradeRows, eventYearRows, activityRows] = await Promise.all([
        cachedQuery("history:projectYears", () =>
                prisma.project.findMany({where: {status: ProjectStatus.PUBLISHED}, select: {developYear: true}, distinct: ["developYear"]}),
            3600),
        cachedQuery("history:memberGrades", () =>
                prisma.clubMember.findMany({select: {grade: true}, distinct: ["grade"]}),
            3600),
        cachedQuery("history:eventYears", () =>
                prisma.yearEvent.findMany({select: {year: true}, distinct: ["year"]}),
            3600),
        cachedQuery("history:activityYears", () =>
                prisma.activity.findMany({
                    where: {status: ActivityStatus.PUBLISHED, type: {not: "MEETING"}},
                    select: {startTime: true},
                }),
            3600),
    ]);

    // 从 grade 字段提取年份（如 "2021级" → 2021）
    const memberYearSet = new Set(
        memberGradeRows
            .filter((m) => m.grade != null)
            .map((m) => parseInt(m.grade!, 10))
            .filter((n) => !isNaN(n) && n >= 2000 && n <= currentYear)
    );

    // 从 activity 的 startTime 提取年份
    const activityYearSet = new Set(
        activityRows.map((a) => a.startTime.getFullYear()).filter((y) => y >= 2000 && y <= currentYear)
    );

    // 合并所有年份
    const allYearsSet = new Set<number>();
    for (const p of projectYearRows) allYearsSet.add(p.developYear);
    for (const y of memberYearSet) allYearsSet.add(y);
    for (const e of eventYearRows) allYearsSet.add(e.year);
    for (const y of activityYearSet) allYearsSet.add(y);

    // 兜底：确保至少检测到 2017 年
    const maxYear = allYearsSet.size > 0 ? Math.max(...allYearsSet) : currentYear;
    const minYear = allYearsSet.size > 0 ? Math.min(Math.min(...allYearsSet), 2017) : 2017;

    // 生成所有需要检查的年份（从最新到最远）
    const allYears: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
        allYears.push(y);
    }

    // 单次批量查询所有年份数据，在 JS 中分组 — 减少查询次数
    const yearDetails: { year: number; projects: any[]; members: any[]; events: any[]; activities: any[] }[] = [];
    
    const [
      allProjects,
      allMembers,
      allEvents,
      allActivities,
    ] = await Promise.all([
      cachedQuery('history:allProjects', () =>
        prisma.project.findMany({
          where: { status: ProjectStatus.PUBLISHED },
          select: { id: true, slug: true, title: true, coverImage: true, type: true, developYear: true },
          orderBy: { publishedAt: "desc" }
        }), 3600),
      cachedQuery('history:allMembers', () =>
        prisma.clubMember.findMany({
          where: { grade: { not: null } },
          select: { id: true, displayName: true, avatar: true, grade: true, user: { select: { image: true } } }
        }), 3600),
      cachedQuery('history:allEvents', () =>
        prisma.yearEvent.findMany({
          orderBy: { sortOrder: "asc" },
          include: { images: { orderBy: { sortOrder: "asc" } } }
        }), 3600),
      cachedQuery('history:allActivities', () =>
        prisma.activity.findMany({
          where: { status: ActivityStatus.PUBLISHED, type: { not: "MEETING" } },
          select: { id: true, title: true, type: true, startTime: true, endTime: true, summary: true, coverImage: true },
          orderBy: { startTime: "asc" }
        }), 3600),
    ]);

    // 在 JS 中按年份分组 — 比每年4次独立查询高效得多
    const projectByYear = new Map<number, any[]>();
    for (const p of allProjects) {
      const y = p.developYear;
      if (y && (!projectByYear.has(y) || [])) {
        if (!projectByYear.has(y)) projectByYear.set(y, []);
        projectByYear.get(y)!.push(p);
      }
    }

    const membersByYear = new Map<number, any[]>();
    for (const m of allMembers) {
      const grade = m.grade;
      if (grade) {
        const match = grade.match(/^(\d{4})/);
        if (match) {
          const y = parseInt(match[1]);
          if (!membersByYear.has(y)) membersByYear.set(y, []);
          membersByYear.get(y)!.push(m);
        }
      }
    }

    const activitiesByYear = new Map<number, any[]>();
    for (const a of allActivities) {
      const y = new Date(a.startTime).getFullYear();
      if (!activitiesByYear.has(y)) activitiesByYear.set(y, []);
      activitiesByYear.get(y)!.push(a);
    }

    for (const year of allYears) {
      const projects = projectByYear.get(year) || [];
      const members = membersByYear.get(year) || [];
      const events = allEvents.filter(e => e.year === year);
      const activities = activitiesByYear.get(year) || [];
      if (projects.length === 0 && members.length === 0 && events.length === 0 && activities.length === 0) continue;
      yearDetails.push({ year, projects, members, events, activities });
    }

    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <div className="mb-10">
                <h1 className="text-3xl font-bold" style={{color: "#25547A"}}>社团历史</h1>
                <p className="mt-2" style={{color: "#777"}}>记录每一届成员的努力与成果</p>
            </div>
            <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 hidden md:block" style={{background: "#D0DEE8"}}/>
                <div className="space-y-16">
                    {yearDetails.map(({year, projects, members, events, activities}) => (
                        <section key={year} className="relative">
                            <div className="flex items-center gap-4 mb-6">
                                <div
                                    className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-sm font-bold shrink-0 ring-4 ring-white/30 text-white"
                                    style={{background: "#25547A"}}>{year % 100}</div>
                                <h2 className="text-2xl font-bold" style={{color: "#E38043"}}>{year}</h2>
                            </div>
                            <div className="md:ml-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                                {members.length > 0 && (
                                    <div className="bg-white rounded-xl p-5 border shadow-sm self-start" style={{borderColor: "#D0DEE8", justifySelf: "start"}}>
                                        <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>{year} 级成员
                                            ({members.length}人)</h3>
                                        <div className="flex flex-wrap gap-3">
                                            {members.map(m => {
                                                const avatarUrl = m.avatar || m.user?.image;
                                                return (
                                                    <Link key={m.id} href={`/members/${m.id}`}
                                                          className="flex items-center gap-2 text-sm hover:text-[#3388BB] transition-colors"
                                                          style={{color: "#555"}}>
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden text-white shrink-0"
                                                            style={{background: "#25547A"}}>
                                                            {avatarUrl ? <SafeImage src={avatarUrl} alt={m.displayName}
                                                                                    className="w-full h-full object-cover"/> : m.displayName[0]}
                                                        </div>
                                                        {m.displayName}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {projects.length > 0 && (
                                    <div className="md:col-span-2 bg-white rounded-xl p-5 border shadow-sm self-start" style={{borderColor: "#D0DEE8", justifySelf: "start"}}>
                                        <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>作品 ({projects.length}件)</h3>
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                            {projects.slice(0, 12).map(p => {
                                                const [g1, g2] = TYPE_GRADIENTS[p.type] || TYPE_GRADIENTS.OTHER;
                                                return (
                                                    <Link key={p.id} href={`/works/${p.slug}`} title={p.title}
                                                          className="block w-full aspect-[4/3] rounded-md overflow-hidden hover:ring-2 hover:ring-[#3388BB] transition-all"
                                                          style={{background: p.coverImage ? "#E6F0F8" : `linear-gradient(135deg, ${g1}, ${g2})`}}
                                                    >
                                                        {p.coverImage ? (
                                                            <SafeImage src={p.coverImage} alt={p.title}
                                                                       className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <div
                                                                className="w-full h-full flex flex-col items-center justify-center text-white px-1">
                                                                <span
                                                                    className="text-[10px] font-semibold opacity-80 text-center leading-tight line-clamp-2">{p.title}</span>
                                                                <span
                                                                    className="text-[8px] opacity-50 mt-0.5">{PROJECT_TYPE_LABELS[p.type] || p.type}</span>
                                                            </div>
                                                        )}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                        {projects.length > 12 &&
                                            <Link href={`/works?year=${year}`} className="text-xs hover:underline flex items-center mt-2"
                                                  style={{color: "#3388BB"}}>查看全部 {projects.length} 件 →</Link>}
                                    </div>
                                )}
                                {events.length > 0 && (
                                    <div className="md:col-span-3 bg-white rounded-xl p-5 border shadow-sm self-start"
                                         style={{borderColor: "#D0DEE8", justifySelf: "start"}}>
                                        <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>大事记</h3>
                                        <div className="space-y-4">
                                            {events.map(event => (
                                                <div key={event.id} className="flex gap-3">
                                                    <div className="text-xs mt-1 shrink-0" style={{color: "#88C232"}}>◆</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="text-sm font-medium" style={{color: "#333"}}>{event.title}</div>
                                                            {event.eventDate && (
                                                                <span className="text-xs" style={{color: "#999"}}>
                                  {new Date(event.eventDate).toLocaleDateString("zh-CN", {month: "short", day: "numeric"})}
                                </span>
                                                            )}
                                                        </div>
                                                        {event.body && <div className="text-xs mt-1 whitespace-pre-wrap"
                                                                            style={{color: "#777"}}>{event.body}</div>}
                                                        {event.images && event.images.length > 0 && (
                                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                                {event.images.map((img: any) => (
                                                                    <div key={img.id}
                                                                         className="relative w-20 h-14 rounded overflow-hidden border"
                                                                         style={{borderColor: "#D0DEE8"}}>
                                                                        <SafeImage src={img.url} alt={img.altText || event.title}
                                                                                   className="object-cover w-full h-full"/>
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
                                {activities.length > 0 && (
                                    <div className="md:col-span-3 bg-white rounded-xl p-5 border shadow-sm self-start"
                                         style={{borderColor: "#D0DEE8", justifySelf: "start"}}>
                                        <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>活动 ({activities.length}场)</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {activities.map(a => (
                                                <Link key={a.id} href={`/activities/${a.id}`}
                                                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 mt-0.5"
                                                         style={{background: "#E6F0F8"}}>
                                                        <img
                                                            src={a.coverImage || "/images/default_pic.png"}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate group-hover:text-[#3388BB] transition-colors"
                                                           style={{color: "#333"}}>{a.title}</p>
                                                        <p className="text-xs mt-0.5" style={{color: "#999"}}>
                              <span className="inline-block px-1.5 py-px rounded mr-1 text-[10px]"
                                    style={{background: "#E6F0F8", color: "#3388BB"}}>
                                {TYPE_LABELS[a.type] || a.type}
                              </span>
                                                            {a.startTime.toLocaleDateString("zh-CN", {month: "short", day: "numeric"})}
                                                        </p>
                                                    </div>
                                                </Link>
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
