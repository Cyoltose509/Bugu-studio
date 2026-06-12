"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { updateProjectStatus } from "./actions";
import DeleteProjectButton from "./DeleteProjectButton";

const TYPE_LABELS: Record<string, string> = {
  IN_DEVELOPMENT: "开发阶段",
  TRIAL_DEMO: "提供试玩",
  MINI_GAME: "小游戏",
  OFFICIAL_RELEASE: "正式上架",
  DEMO: "Demo 演示",
  STEAM: "Steam 发布",
  ITCH: "itch.io 发布",
  OTHER: "其他",
};

interface Project {
  id: string;
  slug: string;
  title: string;
  type: string;
  developYear: number | null;
  status: ProjectStatus;
}

interface Props {
  projects: Project[];
  currentStatus: string;
  currentPage: number;
  totalPages: number;
  statusCounts: { status: ProjectStatus; _count: { status: number } }[];
  allCount: number;
}

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "DRAFT", label: "草稿" },
  { value: "ARCHIVED", label: "已归档" },
];

export default function ProjectsTableClient({
  projects,
  currentStatus,
  currentPage,
  totalPages,
  statusCounts,
  allCount,
}: Props) {
  // 并发锁：useRef 提供同步读取，useState 驱动 UI 禁用
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const withLock = useCallback(async (fn: () => Promise<void>) => {
    // ref 同步守卫，杜绝同帧内两次点击
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      await fn();
    } catch (e) {
      // 出错时释放锁，让用户可以重试
      processingRef.current = false;
      setIsProcessing(false);
      throw e;
    }
    // 成功后不解锁：revalidatePath 会触发页面重渲染，
    // 组件重新挂载时 processingRef 和 isProcessing 自然重置为 false
  }, []);

  const handleApprove = useCallback(
    (id: string) => withLock(() => updateProjectStatus(id, "PUBLISHED")),
    [withLock]
  );

  const handleReject = useCallback(
    (id: string) => withLock(() => updateProjectStatus(id, "REJECTED")),
    [withLock]
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>
          作品管理
        </h1>
        <Link
          href="/admin"
          className="btn-secondary px-4 py-2 rounded-lg text-sm"
        >
          ← 返回仪表盘
        </Link>
      </div>

      {/* 状态筛选 */}
      <div
        className="bg-white rounded-xl border p-4 shadow-sm flex flex-wrap gap-2"
        style={{ borderColor: "#D0DEE8" }}
      >
        {STATUS_TABS.map((tab) => {
          const isAll = tab.value === "";
          const count = isAll
            ? allCount
            : statusCounts.find((c) => c.status === tab.value)?._count.status || 0;
          const active = currentStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/admin/projects?status=${tab.value}&page=1`}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                active ? "font-medium" : ""
              } ${isProcessing ? "pointer-events-none opacity-50" : ""}`}
              style={
                active
                  ? { background: "#25547A", color: "#fff" }
                  : { color: "#555", background: "#F0F5F9" }
              }
              aria-disabled={isProcessing}
              tabIndex={isProcessing ? -1 : undefined}
            >
              {tab.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* 作品列表 */}
      <div
        className="bg-white rounded-xl border shadow-sm overflow-hidden"
        style={{ borderColor: "#D0DEE8" }}
      >
        {projects.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>
            暂无作品
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}
                >
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>
                    标题
                  </th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>
                    类型
                  </th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>
                    年份
                  </th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>
                    状态
                  </th>
                  <th className="text-right p-3 font-medium" style={{ color: "#555" }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b hover:bg-[#F0F5F9] transition-colors"
                    style={{ borderColor: "#EEE" }}
                  >
                    <td className="p-3">
                      <Link
                        href={`/works/${p.slug}`}
                        target="_blank"
                        className="font-medium hover:underline"
                        style={{ color: "#333" }}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#777" }}>
                      {TYPE_LABELS[p.type] || p.type}
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#777" }}>
                      {p.developYear}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Link
                          href={`/works/${p.slug}/edit`}
                          className={`text-xs hover:underline active:opacity-70 ${
                            isProcessing ? "pointer-events-none opacity-40" : ""
                          }`}
                          style={{ color: "#3388BB" }}
                          aria-disabled={isProcessing}
                          tabIndex={isProcessing ? -1 : undefined}
                        >
                          编辑
                        </Link>
                        {(p.status === "PENDING" || p.status === "REJECTED") && (
                          <button
                            type="button"
                            onClick={() => handleApprove(p.id)}
                            disabled={isProcessing}
                            className="text-xs hover:underline cursor-pointer active:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: "#88C232" }}
                          >
                            {isProcessing ? "处理中..." : "通过"}
                          </button>
                        )}
                        {p.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleReject(p.id)}
                            disabled={isProcessing}
                            className="text-xs hover:underline cursor-pointer active:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: "#C62828" }}
                          >
                            {isProcessing ? "处理中..." : "拒绝"}
                          </button>
                        )}
                        <DeleteProjectButton projectId={p.id} disabled={isProcessing} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/admin/projects?status=${currentStatus}&page=${currentPage - 1}`}
              className={`btn-secondary px-3 py-1.5 rounded-lg text-sm ${
                isProcessing ? "pointer-events-none opacity-50" : ""
              }`}
              aria-disabled={isProcessing}
              tabIndex={isProcessing ? -1 : undefined}
            >
              上一页
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/admin/projects?status=${currentStatus}&page=${currentPage + 1}`}
              className={`btn-secondary px-3 py-1.5 rounded-lg text-sm ${
                isProcessing ? "pointer-events-none opacity-50" : ""
              }`}
              aria-disabled={isProcessing}
              tabIndex={isProcessing ? -1 : undefined}
            >
              下一页
            </Link>
          )}
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
    DRAFT: { bg: "#F5F5F9", color: "#777", label: "草稿" },
    ARCHIVED: { bg: "#EDE7F6", color: "#5E35B1", label: "已归档" },
  };
  const s = map[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
