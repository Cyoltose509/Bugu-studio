import {Metadata} from "next";
import YearNewspaper from "@/components/history/YearNewspaper";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus, ActivityStatus} from "@prisma/client";

export const metadata: Metadata = {title: "社团历史", description: "记录布谷工作室每一年的成长与创作"};
export const dynamic = "force-dynamic"; // 避免构建时并发连接池耗尽

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
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold" style={{color: "#25547A"}}>社团历史</h1>
                <p className="mt-2" style={{color: "#777"}}>记录每一届成员的努力与成果</p>
                <p className="mt-1 text-xs" style={{color: "#b8a590"}}>
                    共 {yearDetails.length} 年 · 点击年报中的"保存/打印"按钮即可保存为 PDF
                </p>
            </div>

            <div className="space-y-8">
                {yearDetails.map(({year, projects, members, events, activities}) => (
                    <YearNewspaper
                        key={year}
                        year={year}
                        members={members}
                        projects={projects}
                        events={events}
                        activities={activities}
                        totalYears={allYears.length}
                    />
                ))}
            </div>
        </div>
    );
}
