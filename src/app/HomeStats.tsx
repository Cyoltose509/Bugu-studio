/**
 * 首页统计数据 — 直接查询，较快
 */
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

export default async function HomeStats() {
  const foundedYear = parseInt(process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2018");
  const [memberCount, projectCount, steamCount] = await Promise.all([
    prisma.clubMember.count(),
    prisma.project.count({ where: { status: ProjectStatus.PUBLISHED } }),
    prisma.project.count({ where: { status: ProjectStatus.PUBLISHED, type: "STEAM" } }),
  ]);

  return (
    <section className="py-10 border-y" style={{ borderColor: "#D0DEE8", background: "rgba(255,255,255,0.6)" }}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value={`${new Date().getFullYear() - foundedYear + 1}年`} label="社团历史" />
          <Stat value={`${memberCount}+`} label="历届成员" />
          <Stat value={`${projectCount}+`} label="累计作品" />
          <Stat value={`${steamCount}`} label="Steam 发布" />
        </div>
      </div>
    </section>
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
