/**
 * 管理后台 - 活动管理列表
 * 支持按状态筛选、创建、编辑、删除、归档
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityStatus, ActivityType } from "@prisma/client";
import { deleteActivity, updateActivityStatus } from "./actions";
import DeleteButton from "@/components/admin/ActivityDeleteButton";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "活动管理 - 管理后台" };
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "DRAFT", label: "草稿" },
  { value: "ARCHIVED", label: "已归档" },
];

const TYPE_LABELS: Record<string, string> = {
  MEETING:    "例会",
  COURSE:     "公开课",
  COMPETITION: "比赛",
  GENERAL:    "普通活动",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "草稿",
  PUBLISHED: "已发布",
  ARCHIVED:  "已归档",
};

const DEFAULT_COVER = "/images/default_pic.png";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminActivitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status || "";
  const page   = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip  = (page - 1) * pageSize;

  const where: any = {};
  if (status) where.status = status as ActivityStatus;

  const cacheKey = `admin:activities:${status}:${page}`;

  const [activities, total, statusCounts, allCount] = await cachedQuery(
    cacheKey,
    () =>
      Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: { startTime: "desc" },
          skip,
          take: pageSize,
          include: { _count: { select: { proposals: true } } },
        }),
        prisma.activity.count({ where }),
        prisma.activity.groupBy({ by: ["status"], _count: { status: true } }),
        prisma.activity.count(),
      ]),
    15
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>活动管理</h1>
        <div className="flex gap-2">
          <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
          <Link href="/admin/activities/create" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">+ 创建活动</Link>
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-wrap gap-2" style={{ borderColor: "#D0DEE8" }}>
        {STATUS_TABS.map(tab => {
          const isAll = tab.value === "";
          const count = isAll ? allCount : statusCounts.find(c => c.status === tab.value)?._count.status || 0;
          const active = status === tab.value;
          return (
            <Link key={tab.value} href={`/admin/activities?status=${tab.value}&page=1`}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium" : ""}`}
              style={active ? { background: "#25547A", color: "#fff" } : { color: "#555", background: "#F0F5F9" }}>
              {tab.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* 活动列表 */}
      <div className="space-y-3">
        {activities.length === 0 && (
          <div className="text-center py-12 text-gray-400">暂无活动，点击右上角"创建活动"开始</div>
        )}
        {activities.map(activity => {
          const now = new Date();
          let timeLabel = "";
          if (now < activity.startTime)        timeLabel = "即将开始";
          else if (now > activity.endTime)      timeLabel = "已结束";
          else                                  timeLabel = "进行中";

          return (
            <div key={activity.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-wrap items-center gap-4" style={{ borderColor: "#D0DEE8" }}>
              {/* 封面 */}
              <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "#E6F0F8" }}>
                <img src={activity.coverImage || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/activities/${activity.id}`} target="_blank" className="font-semibold hover:text-[#3388BB]" style={{ color: "#333" }}>
                    {activity.title}
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                    {TYPE_LABELS[activity.type] || activity.type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activity.status === "PUBLISHED" ? "bg-green-100 text-green-700" :
                    activity.status === "DRAFT"     ? "bg-gray-100 text-gray-600" :
                                                     "bg-yellow-100 text-yellow-700"
                  }`}>{STATUS_LABELS[activity.status] || activity.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E38043" }}>{timeLabel}</span>
                </div>
                <p className="text-xs mt-1 truncate" style={{ color: "#777" }}>
                  {activity.startTime.toLocaleDateString("zh-CN")} ~ {activity.endTime.toLocaleDateString("zh-CN")}
                  {activity.location ? ` · ${activity.location}` : ""}
                  {activity.registrationOpen ? " · 开放报名" : ""}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#999" }}>
                  申请 {activity._count.proposals}
                </p>
              </div>

              {/* 操作 */}
              <div className="flex gap-2 shrink-0">
                {activity.status === "DRAFT" && (
                  <form action={async () => { "use server"; await updateActivityStatus(activity.id, ActivityStatus.PUBLISHED); }}>
                    <SubmitButton type="submit" className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "#22C55E", color: "#22C55E" }} pendingText="发布中...">发布</SubmitButton>
                  </form>
                )}
                {activity.status === "PUBLISHED" && (
                  <form action={async () => { "use server"; await updateActivityStatus(activity.id, ActivityStatus.ARCHIVED); }}>
                    <SubmitButton type="submit" className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "#EAB308", color: "#EAB308" }} pendingText="归档中...">归档</SubmitButton>
                  </form>
                )}
                <Link href={`/admin/activities/${activity.id}/edit`} className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "#3388BB", color: "#3388BB" }}>编辑</Link>
                <DeleteButton id={activity.id} title={activity.title} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`/admin/activities?status=${status}&page=${p}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${p === page ? "font-bold text-white" : ""}`}
              style={p === page ? { background: "#25547A" } : { color: "#555", background: "#F0F5F9" }}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
