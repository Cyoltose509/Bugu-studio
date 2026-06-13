import {Metadata} from "next";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import MembersList from "@/components/members/MembersList";

export const metadata: Metadata = {title: "成员", description: "认识历届布谷工作室成员"};
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

export default async function MembersPage() {
    const members = await cachedQuery('members:all', async () => {
        const list = await prisma.clubMember.findMany({
            orderBy: [{sortOrder: "asc"}],
            select: {
                id: true, displayName: true, avatar: true, grade: true,
                joinYear: true, graduated: true, position: true,
                userId: true, skills: true,
                user: {select: {image: true}},
                _count: {select: {projectMembers: {where: {project: {status: "PUBLISHED"}}}}},
            },
        });

        // ── 防御性计数：也统计成员作为提交者的项目数（修复历史孤儿数据）──
        const userIds = list.map((m) => m.userId).filter(Boolean);
        const submitterCounts = userIds.length > 0
            ? await prisma.project.groupBy({
                by: ["submitterId"],
                where: {submitterId: {in: userIds}, status: "PUBLISHED"},
                _count: {submitterId: true},
            })
            : [];
        const submitterMap = new Map(submitterCounts.map((g) => [g.submitterId, g._count.submitterId]));

        return list.map((m) => ({
            ...m,
            projectCount: Math.max(
                m._count.projectMembers,
                submitterMap.get(m.userId) ?? 0,
            ),
        }));
    }, 300);
    // 按 grade（如 2024 → "2024级"）分组，无 grade 时按 joinYear 分组
    const grouped = members.reduce<Record<string, typeof members>>((acc, m: any) => {
        const key = m.grade ? `${m.grade}级` : (m.joinYear ? `${m.joinYear} 年入社` : "未知");
        (acc[key] ??= []).push(m);
        return acc;
    }, {});
    // 按提取出的年份降序排列
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const yA = parseInt(a) || 0;
        const yB = parseInt(b) || 0;
        return yB - yA;
    });

    const activeCount = members.filter((m: any) => !m.graduated).length;

    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-brand-navy">成员列表</h1>
                <p className="mt-2 text-brand-text-secondary">共 {members.length} 位历届成员，{activeCount} 位在读成员</p>
            </div>
            <MembersList
                members={members as any}
                grouped={grouped}
                sortedKeys={sortedKeys}
            />
        </div>
    );
}
