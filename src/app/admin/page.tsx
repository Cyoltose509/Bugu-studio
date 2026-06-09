/**
 * 管理后台 - 仪表盘
 * 展示站点核心统计数据
 */

import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import SyncOrphanedButton from "./SyncOrphanedButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [userCount, memberCount, projectCount, pendingCount, latestUsers, latestProjects] =
    await Promise.all([
      cachedQuery('admin:userCount', () => prisma.user.count(), 30),
      cachedQuery('admin:memberCount', () => prisma.clubMember.count(), 30),
      cachedQuery('admin:projectCount', () => prisma.project.count(), 30),
      cachedQuery('admin:pendingCount', () => prisma.project.count({ where: { status: ProjectStatus.PENDING } }), 30),
      cachedQuery('admin:latestUsers', () => prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, role: true, createdAt: true } }), 15),
      cachedQuery('admin:latestProjects', () => prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, createdAt: true } }), 15),
    ]);

  const stats = [
    { label: "注册用户", value: userCount, icon: "👤", color: "#3388BB", href: "/admin/users" },
    { label: "社团成员", value: memberCount, icon: "👥", color: "#88C232", href: "/admin/members" },
    { label: "作品总数", value: projectCount, icon: "🎮", color: "#E38043", href: "/admin/projects" },
    { label: "待审核", value: pendingCount, icon: "⏳", color: "#E8A040", href: "/admin/projects?status=PENDING" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href}
            className="bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow"
            style={{ borderColor: "#D0DEE8" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
            <div className="text-sm font-medium" style={{ color: "#555" }}>{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最新用户 */}
        <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>最新用户</h2>
          <div className="space-y-3">
            {latestUsers.length === 0 ? (
              <p className="text-sm" style={{ color: "#777" }}>暂无用户</p>
            ) : (
              latestUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#333" }}>{u.name || "未命名"}</div>
                    <div className="text-xs" style={{ color: "#777" }}>{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: u.role === "ADMIN" ? "#FDE8E8" : u.role === "MEMBER" ? "#E8F5E9" : "#E6F0F8",
                      color: u.role === "ADMIN" ? "#C62828" : u.role === "MEMBER" ? "#2E7D32" : "#25547A",
                    }}>{u.role}</span>
                    <span className="text-xs" style={{ color: "#999" }}>
                      {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 最新作品 */}
        <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>最新作品</h2>
          <div className="space-y-3">
            {latestProjects.length === 0 ? (
              <p className="text-sm" style={{ color: "#777" }}>暂无作品</p>
            ) : (
              latestProjects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#333" }}>{p.title}</div>
                    <div className="text-xs" style={{ color: "#999" }}>
                      {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: p.status === "PUBLISHED" ? "#E8F5E9" : p.status === "PENDING" ? "#FFF3E0" : p.status === "DRAFT" ? "#EEE" : "#FDE8E8",
                    color: p.status === "PUBLISHED" ? "#2E7D32" : p.status === "PENDING" ? "#E65100" : p.status === "DRAFT" ? "#777" : "#C62828",
                  }}>
                    {p.status === "PUBLISHED" ? "已发布" : p.status === "PENDING" ? "待审核" : p.status === "DRAFT" ? "草稿" : p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>快捷操作</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Link href="/admin/projects" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">管理作品</Link>
          <Link href="/admin/members" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">管理成员</Link>
          <Link href="/admin/users" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">管理用户</Link>
          <Link href="/admin/settings" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">站点设置</Link>
          <Link href="/" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">返回前台</Link>
          <SyncOrphanedButton />
        </div>
      </div>
    </div>
  );
}
