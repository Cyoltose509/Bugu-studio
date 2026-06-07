/**
 * 成员列表页
 */

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "成员",
  description: "认识历届布谷工作室成员",
};

export const revalidate = 300;

export default async function MembersPage() {
  const members = await prisma.clubMember.findMany({
    orderBy: [{ joinYear: "desc" }, { sortOrder: "asc" }],
    include: {
      _count: { select: { projectMembers: true } },
    },
  });

  // 按年份分组
  const grouped = members.reduce<Record<number, typeof members>>(
    (acc, member) => {
      const year = member.joinYear;
      if (!acc[year]) acc[year] = [];
      acc[year].push(member);
      return acc;
    },
    {}
  );

  const sortedYears = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">成员列表</h1>
        <p className="text-gray-400 mt-2">
          共 {members.length} 位历届成员
        </p>
      </div>

      {sortedYears.map((year) => (
        <section key={year} className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-3">
            <span>{year} 级</span>
            <span className="text-sm text-gray-500 font-normal">
              {grouped[year].length} 人
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {grouped[year].map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="group text-center p-4 rounded-xl bg-gray-900 border border-white/10 hover:border-indigo-500/50 transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold mx-auto mb-3 overflow-hidden">
                  {member.avatar ? (
                    <Image
                      src={member.avatar}
                      alt={member.displayName}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  ) : (
                    member.displayName[0]
                  )}
                </div>
                <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                  {member.displayName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {member._count.projectMembers} 个项目
                </div>
                {!member.isActive && (
                  <div className="text-xs text-gray-600 mt-0.5">已毕业</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
