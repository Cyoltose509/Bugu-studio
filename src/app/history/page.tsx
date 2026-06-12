import {Metadata} from "next";
import HistoryClient from "@/components/history/HistoryClient";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {batchRenderRichContent} from "@/lib/renderRichContent";
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
                    where: {status: { in: [ActivityStatus.PUBLISHED, ActivityStatus.ARCHIVED] }, type: {not: "MEETING"}},
                    select: {startTime: true},
                }),
            3600),
    ]);

    // 从 grade 字段提取年份（如 "2021级" → 2021）
    const memberYearSet = new Set(
        memberGradeRows
            .filter((m) => m.grade != null)
            .map((m) => m.grade!)
            .filter((n) => n >= 2000 && n <= currentYear)
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

    // 兜底：从 2019 起步（创始人是 2017 届但 2019 年起才有实际产出）
    const START_YEAR = 2019;
    const maxYear = allYearsSet.size > 0 ? Math.max(...allYearsSet) : currentYear;
    const minYear = Math.max(START_YEAR, allYearsSet.size > 0 ? Math.min(...allYearsSet) : START_YEAR);

    // 生成所有需要检查的年份（从最新到最早 → 最新年报排最上面）
    const allYears: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
        allYears.push(y);
    }

    // 单次批量查询所有年份数据，在 JS 中分组 — 减少查询次数
    const yearDetails: { year: number; projects: any[]; members: any[]; events: any[]; activities: any[]; activeMembers: any[] }[] = [];
    
    const [
      allProjects,
      allMembers,
      allEvents,
      allActivities,
      allJamMembers,
      allMeetingShares,
    ] = await Promise.all([
      cachedQuery('history:allProjects', () =>
        prisma.project.findMany({
          where: { status: ProjectStatus.PUBLISHED },
          select: { id: true, slug: true, title: true, subtitle: true, coverImage: true, type: true, developYear: true, tags: { select: { tag: { select: { name: true } } } }, members: { select: { memberId: true, externalName: true, roles: true, member: { select: { displayName: true } } } }, _count: { select: { likes: true } } },
          orderBy: { publishedAt: "desc" }
        }), 3600),
      cachedQuery('history:allMembers', () =>
        prisma.clubMember.findMany({
          select: { id: true, userId: true, displayName: true, avatar: true, grade: true, joinYear: true, user: { select: { image: true } }, _count: { select: { projectMembers: true } } }
        }), 3600),
      cachedQuery('history:allEvents', () =>
        prisma.yearEvent.findMany({
          orderBy: { sortOrder: "asc" },
          include: { images: { orderBy: { sortOrder: "asc" } } }
        }), 3600),
      cachedQuery('history:allActivities', () =>
        prisma.activity.findMany({
          where: { status: { in: [ActivityStatus.PUBLISHED, ActivityStatus.ARCHIVED] } },
          select: { id: true, title: true, type: true, status: true, startTime: true, endTime: true, summary: true, description: true, coverImage: true },
          orderBy: { startTime: "asc" }
        }), 3600),
      // 活跃度计算 — 比赛参与（JamTeamMember → JamTeam → Activity）
      cachedQuery('history:jamMembers', () =>
        prisma.jamTeamMember.findMany({
          select: { userId: true, team: { select: { activity: { select: { startTime: true, type: true } } } } }
        }), 3600),
      // 活跃度计算 — 例会分享（MeetingProposal APPROVED）
      cachedQuery('history:meetingShares', () =>
        prisma.meetingProposal.findMany({
          where: { status: "APPROVED" },
          select: { userId: true, activity: { select: { startTime: true, type: true } } }
        }), 3600),
    ]);

    // ── 预渲染富文本（@mention + URL → HTML），一次 DB 查询解析所有 @mention ──
    const eventBodies = allEvents.map(e => e.body).filter(Boolean) as string[];
    const activityTexts = allActivities.flatMap(a => [a.description, a.summary].filter(Boolean) as string[]);
    const richHtmlMap = await batchRenderRichContent([...eventBodies, ...activityTexts]);
    // 将预渲染 HTML 附加到对应对象
    for (const e of allEvents) {
      if (e.body) (e as any).bodyHtml = richHtmlMap.get(e.body) || "";
    }
    for (const a of allActivities) {
      const raw = (a.description || a.summary || "").replace(/\n{3,}/g, "\n\n").trim();
      if (raw) (a as any).descriptionHtml = richHtmlMap.get(a.description || a.summary || "") || "";
    }

    // userId → ClubMember 映射（用于活跃度计算）
    const userIdToMember = new Map<string, any>();
    for (const m of allMembers) {
      if (m.userId) userIdToMember.set(m.userId, m);
    }

    // 在 JS 中按年份分组 — 比每年4次独立查询高效得多
    const projectByYear = new Map<number, any[]>();
    for (const p of allProjects) {
      const y = p.developYear;
      if (y && (!projectByYear.has(y) || [])) {
        if (!projectByYear.has(y)) projectByYear.set(y, []);
        projectByYear.get(y)!.push(p);
      }
    }

    // 从 joinYear 分组成员（用于"新血液"）
    const newBloodByYear = new Map<number, any[]>();
    for (const m of allMembers) {
      if (m.joinYear) {
        if (!newBloodByYear.has(m.joinYear)) newBloodByYear.set(m.joinYear, []);
        newBloodByYear.get(m.joinYear)!.push(m);
      }
    }

    // 从 grade 分组成员（用于显示年级信息）
    const membersByGrade = new Map<number, any[]>();
    for (const m of allMembers) {
      if (m.grade) {
        if (!membersByGrade.has(m.grade)) membersByGrade.set(m.grade, []);
        membersByGrade.get(m.grade)!.push(m);
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
      const newBlood = newBloodByYear.get(year) || [];
      const events = allEvents.filter(e => e.year === year);
      const activities = activitiesByYear.get(year) || [];
      if (newBlood.length === 0 && events.length === 0 && activities.length === 0 && projects.length === 0) continue;
      
      // ─── 活跃度计算（跨年统计 — 统计所有成员在该年的贡献） ───
      // 作品制作：该年作品中的 memberId 计数
      const projectContrib = new Map<string, number>();
      for (const p of projects) {
        for (const pm of (p.members || [])) {
          if (pm.memberId) {
            projectContrib.set(pm.memberId, (projectContrib.get(pm.memberId) || 0) + 1);
          }
        }
      }
      
      // 比赛参与：该年 COMPETITION 活动中，JamTeamMember 通过 userId → memberId
      const competitionContrib = new Map<string, number>();
      for (const jm of allJamMembers) {
        const actYear = jm.team?.activity?.startTime ? new Date(jm.team.activity.startTime).getFullYear() : null;
        if (actYear === year && jm.team?.activity?.type === "COMPETITION") {
          const member = userIdToMember.get(jm.userId);
          if (member) {
            competitionContrib.set(member.id, (competitionContrib.get(member.id) || 0) + 1);
          }
        }
      }
      
      // 公开课参与：该年 COURSE 活动中，JamTeamMember 通过 userId → memberId（与比赛同一套报名系统）
      const courseContrib = new Map<string, number>();
      for (const jm of allJamMembers) {
        const actYear = jm.team?.activity?.startTime ? new Date(jm.team.activity.startTime).getFullYear() : null;
        if (actYear === year && jm.team?.activity?.type === "COURSE") {
          const member = userIdToMember.get(jm.userId);
          if (member) {
            courseContrib.set(member.id, (courseContrib.get(member.id) || 0) + 1);
          }
        }
      }
      
      // 例会分享：该年 MEETING 活动中 APPROVED 的 MeetingProposal
      const meetingContrib = new Map<string, number>();
      for (const mp of allMeetingShares) {
        const actYear = mp.activity?.startTime ? new Date(mp.activity.startTime).getFullYear() : null;
        if (actYear === year && mp.activity?.type === "MEETING") {
          const member = userIdToMember.get(mp.userId);
          if (member) {
            meetingContrib.set(member.id, (meetingContrib.get(member.id) || 0) + 1);
          }
        }
      }
      
      // 汇总得分：作品×1 + 比赛×1 + 例会×0.4 + 公开课×0.8
      const scoreMap = new Map<string, { score: number; projects: number; competitions: number; courses: number; meetings: number }>();
      const allMemberIds = new Set([
        ...projectContrib.keys(), ...competitionContrib.keys(), ...courseContrib.keys(), ...meetingContrib.keys(),
      ]);
      for (const mid of allMemberIds) {
        const p = projectContrib.get(mid) || 0;
        const c = competitionContrib.get(mid) || 0;
        const r = courseContrib.get(mid) || 0;
        const m = meetingContrib.get(mid) || 0;
        const score = p + c + r * 0.8 + m * 0.4;
        if (score > 0) scoreMap.set(mid, { score: Math.round(score * 10) / 10, projects: p, competitions: c, courses: r, meetings: m });
      }
      
      // 归档活跃成员（按得分降序）
      const activeMembers = [...scoreMap.entries()]
        .map(([memberId, s]) => {
          const member = allMembers.find(m => m.id === memberId);
          return member ? { ...member, ...s } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.score - a.score);
      
      yearDetails.push({ year, projects, members: newBlood, events, activities, activeMembers });
    }

    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold" style={{color: "#25547A"}}>社团历史</h1>
                <p className="mt-2" style={{color: "#777"}}>记录每一届成员的努力与成果</p>
            </div>

            <HistoryClient
                yearDetails={yearDetails}
                startYear={START_YEAR}
                yearCount={yearDetails.length}
            />
        </div>
    );
}
