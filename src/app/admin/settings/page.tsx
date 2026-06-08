/**
 * 管理后台 - 站点设置
 */

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const settings = await prisma.siteSetting.findMany({
    orderBy: { key: "asc" },
  });

  // 统计信息
  const [userCount, projectCount, memberCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.clubMember.count(),
  ]);

  const infoCards = [
    { label: "站点名称", value: process.env.NEXT_PUBLIC_SITE_NAME || "布谷工作室" },
    { label: "站点地址", value: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost" },
    { label: "成立年份", value: process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2018" },
    { label: "Node 环境", value: process.env.NODE_ENV || "production" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>站点设置</h1>

      {/* 站点信息 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {infoCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
            <div className="text-xs mb-1" style={{ color: "#777" }}>{card.label}</div>
            <div className="font-semibold" style={{ color: "#25547A" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 数据统计 */}
      <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>数据统计</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: "#3388BB" }}>{userCount}</div>
            <div className="text-sm mt-1" style={{ color: "#777" }}>注册用户</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: "#88C232" }}>{memberCount}</div>
            <div className="text-sm mt-1" style={{ color: "#777" }}>社团成员</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: "#E38043" }}>{projectCount}</div>
            <div className="text-sm mt-1" style={{ color: "#777" }}>作品项目</div>
          </div>
        </div>
      </div>

      {/* 自定义配置 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        <div className="p-4 border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
          <h2 className="font-semibold" style={{ color: "#25547A" }}>自定义配置</h2>
        </div>
        {settings.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>
            暂无自定义配置项。可通过直接操作数据库 <code className="bg-gray-100 px-1 py-0.5 rounded text-xs" style={{ color: "#25547A" }}>SiteSetting</code> 表添加。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#D0DEE8" }}>
                <th className="p-3 font-medium" style={{ color: "#555" }}>键</th>
                <th className="p-3 font-medium" style={{ color: "#555" }}>值</th>
                <th className="p-3 font-medium" style={{ color: "#555" }}>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {settings.map(s => (
                <tr key={s.key} className="border-b" style={{ borderColor: "#EEE" }}>
                  <td className="p-3 font-mono text-xs" style={{ color: "#25547A" }}>{s.key}</td>
                  <td className="p-3 text-sm" style={{ color: "#333", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.value}
                  </td>
                  <td className="p-3 text-xs" style={{ color: "#999" }}>
                    {new Date(s.updatedAt).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
