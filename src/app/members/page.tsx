import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";

export const metadata: Metadata = { title: "成员", description: "认识历届布谷工作室成员" };
export const revalidate = 300;

export default async function MembersPage() {
  const members = await cachedQuery('members:all', () =>
    prisma.clubMember.findMany({
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true, displayName: true, avatar: true, grade: true,
        joinYear: true, isActive: true, position: true,
        user: { select: { image: true } },
        _count: { select: { projectMembers: true } },
      },
    })
  , 300);
  // 按 grade（如 "2024级"）分组，无 grade 时按 joinYear 分组
  const grouped = members.reduce<Record<string, typeof members>>((acc, m) => {
    const key = m.grade || `${m.joinYear} 年入社`;
    (acc[key] ??= []).push(m);
    return acc;
  }, {});
  // 按提取出的年份降序排列
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const yA = parseInt(a) || 0;
    const yB = parseInt(b) || 0;
    return yB - yA;
  });

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>成员列表</h1>
        <p className="mt-2" style={{ color: "#777" }}>共 {members.length} 位历届成员</p>
      </div>
      {sortedKeys.map(key => (
        <section key={key} className="mb-12">
          <h2 className="text-xl font-semibold mb-5 flex items-center gap-3" style={{ color: "#25547A" }}>
            <span>{key}</span>
            <span className="text-sm font-normal" style={{ color: "#999" }}>{grouped[key].length} 人</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {grouped[key].map(m => (
              <Link key={m.id} href={`/members/${m.id}`} className="group text-center p-4 rounded-xl bg-white border shadow-sm hover:shadow-md transition-all" style={{ borderColor: "#D0DEE8" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 overflow-hidden" style={{ background: "#E38043", color: "#fff" }}>
                  {(m.user?.image || m.avatar) ? <img src={(m.user?.image || m.avatar)!} alt={m.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : m.displayName[0]}
                </div>
                <div className="text-sm font-medium group-hover:text-[#3388BB] transition-colors line-clamp-1 flex items-center gap-1" style={{ color: "#333" }}>
                  {m.displayName}
                  {m.position && m.position !== "MEMBER" && (
                    <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: "#25547A", color: "#fff" }}>
                      {m.position === "PRESIDENT" ? "社长" : m.position === "VICE_PRESIDENT" ? "副社长" : m.position}
                    </span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#999" }}>{m._count.projectMembers} 个项目</div>
                {!m.isActive && <div className="text-xs mt-0.5" style={{ color: "#aaa" }}>已毕业</div>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
