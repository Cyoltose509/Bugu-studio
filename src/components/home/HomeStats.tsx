/**
 * 首页统计数据 — 使用缓存减少数据库查询
 */
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus} from "@prisma/client";
import {isMockDataEnabled, mockStats} from "@/lib/mock/frontend-data";
import {getClubAgeDays, getClubAgeYears} from "@/lib/club";
import ClubAgeStat from "@/components/home/ClubAgeStat";

export default async function HomeStats() {
    const years = getClubAgeYears();
    const days = getClubAgeDays();
    const [memberCount, projectCount, releasedCount] = isMockDataEnabled()
        ? (() => {
            const s = mockStats();
            return [s.memberCount, s.projectCount, s.releasedCount] as const;
        })()
        : await Promise.all([
        cachedQuery('stats:memberCount', () => prisma.clubMember.count(), 300),
        cachedQuery('stats:projectCount', () => prisma.project.count({where: {status: ProjectStatus.PUBLISHED}}), 300),
        cachedQuery('stats:releasedCount', () => prisma.project.count({
            where: {
                status: ProjectStatus.PUBLISHED,
                type: "OFFICIAL_RELEASE"
            }
        }), 300),
    ]).catch(() => [0, 0, 0] as const);

    return (
        <section className="py-10 border-y stats-gradient border-brand-border-subtle">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    <ClubAgeStat years={years} days={days} />
                    <Stat value={`${memberCount}+`} label="历届成员"/>
                    <Stat value={`${projectCount}+`} label="累计作品"/>
                    <Stat value={`${releasedCount}`} label="正式上架"/>
                </div>
            </div>
        </section>
    );
}

function Stat({value, label}: { value: string; label: string }) {
    return (
        <div>
            <div className="text-3xl font-bold text-brand-orange">{value}</div>
            <div className="text-sm mt-1 text-brand-text-secondary">{label}</div>
        </div>
    );
}
