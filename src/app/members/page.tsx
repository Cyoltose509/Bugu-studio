import {Metadata} from "next";
import {Suspense} from "react";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import MembersList from "@/components/members/MembersList";
import LogoLoading from "@/components/ui/LogoLoading";
import {isMockDataEnabled, mockMembersList} from "@/lib/mock/frontend-data";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export async function generateMetadata(): Promise<Metadata> {
    const lang = await getLang();
    return {title: t(lang, "page.members.title"), description: t(lang, "page.members.description")};
}
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

/**
 * 成员页面 — 流式渲染
 * async 组件确保路由级 loading.tsx 正确触发
 * 数据在 Suspense 内异步加载，首字节不阻塞
 */
export default async function MembersPage() {
    const lang = await getLang();
    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <Suspense fallback={<MembersHeaderSkeleton lang={lang} />}>
                <MembersData />
            </Suspense>
        </div>
    );
}

/** 加载中占位：标题先渲染出来，避免数据到达时标题跳动 */
function MembersHeaderSkeleton({ lang = "cn" }: { lang?: "cn" | "en" }) {
    return (
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-brand-navy">{t(lang, "page.members.title")}</h1>
            <div className="mt-2">
                <LogoLoading text={t(lang, "loading.membersShort")} compact />
            </div>
        </div>
    );
}

/** 成员数据 — 异步组件（Suspense 包裹，流式加载） */
async function MembersData() {
    const members = isMockDataEnabled()
        ? mockMembersList()
        : await cachedQuery('members:all', async () => {
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
    }, 300).catch(() => mockMembersList());

    const activeCount = members.filter((m: any) => !m.graduated).length;

    return (
        <MembersList
            members={members as any}
            totalCount={members.length}
            activeCount={activeCount}
        />
    );
}

