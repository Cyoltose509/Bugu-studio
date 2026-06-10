/**
 * 管理后台 - 作品管理
 * 支持按状态筛选、审核、删除、设精选
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { updateProjectStatus, toggleFeatured } from "./actions";
import DeleteProjectButton from "./DeleteProjectButton";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "作品管理 - 管理后台" };
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "DRAFT", label: "草稿" },
  { value: "ARCHIVED", label: "已归档" },
];

const TYPE_LABELS: Record<string, string> = { DEMO: "Demo 演示", STEAM: "Steam 发布", ITCH: "itch.io 发布", OTHER: "其他" };

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (status) where.status = status as ProjectStatus;

  const cacheKey = `admin:projects:${status}:${page}`;

  const [projects, total, statusCounts, allCount] = await cachedQuery(cacheKey, () =>
    Promise.all([
      prisma.project.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.project.count({ where }),
      prisma.project.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.project.count(),
    ]), 15);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>作品管理</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
      </div>

      {/* 状态筛选 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-wrap gap-2" style={{ borderColor: "#D0DEE8" }}>
        {STATUS_TABS.map(tab => {
          const isAll = tab.value === "";
          const count = isAll ? allCount : statusCounts.find(c => c.status === tab.value)?._count.status || 0;
          const active = status === tab.value;
          return (
            <Link key={tab.value} href={`/admin/projects?status=${tab.value}&page=1`}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium" : ""}`}
              style={active ? { background: "#25547A", color: "#fff" } : { color: "#555", background: "#F0F5F9" }}>
              {tab.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* 作品列表 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        {projects.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>暂无作品</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>标题</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>类型</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>年份</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>状态</th>
                <th className="text-center p-3 font-medium" style={{ color: "#555" }}>精选</th>
                <th className="text-right p-3 font-medium" style={{ color: "#555" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b hover:bg-[#F0F5F9] transition-colors" style={{ borderColor: "#EEE" }}>
                  <td className="p-3">
                    <Link href={`/works/${p.slug}`} target="_blank" className="font-medium hover:underline" style={{ color: "#333" }}>{p.title}</Link>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "#777" }}>{TYPE_LABELS[p.type] || p.type}</td>
                  <td className="p-3 text-xs" style={{ color: "#777" }}>{p.developYear}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-center">
                    <form action={toggleFeatured.bind(null, p.id, p.isFeatured)} className="inline">
                      <button type="submit" className="text-sm cursor-pointer hover:scale-125 transition-transform" style={{ color: p.isFeatured ? "#E38043" : "#CCC" }}>
                        {p.isFeatured ? "★" : "☆"}
                      </button>
                    </form>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link
                        href={`/works/${p.slug}/edit`}
                        className="text-xs hover:underline"
                        style={{ color: "#3388BB" }}
                      >
                        编辑
                      </Link>
                      {p.status === "PENDING" && (
                        <form action={updateProjectStatus.bind(null, p.id, "PUBLISHED")} className="inline">
                          <SubmitButton type="submit" className="text-xs hover:underline cursor-pointer" style={{ color: "#88C232" }} pendingText="通过中...">通过</SubmitButton>
                        </form>
                      )}
                      {p.status === "PENDING" && (
                        <form action={updateProjectStatus.bind(null, p.id, "REJECTED")} className="inline">
                          <SubmitButton type="submit" className="text-xs hover:underline cursor-pointer" style={{ color: "#C62828" }} pendingText="拒绝中...">拒绝</SubmitButton>
                        </form>
                      )}
                      <DeleteProjectButton projectId={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link href={`/admin/projects?status=${status}&page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/projects?status=${status}&page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { bg: string; color: string; label: string }> = {
    PUBLISHED: { bg: "#E8F5E9", color: "#2E7D32", label: "已发布" },
    PENDING: { bg: "#FFF3E0", color: "#E65100", label: "待审核" },
    REJECTED: { bg: "#FDE8E8", color: "#C62828", label: "已拒绝" },
    DRAFT: { bg: "#F5F5F5", color: "#777", label: "草稿" },
    ARCHIVED: { bg: "#EDE7F6", color: "#5E35B1", label: "已归档" },
  };
  const s = map[status];
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}
