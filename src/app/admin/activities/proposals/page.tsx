/**
 * 管理后台 - 活动申请 / 报名 / 提交 审核
 */

import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { reviewProposal, scoreEnrollment, scoreSubmission } from "../actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import DeleteSubmissionButton from "./DeleteSubmissionButton";
import { ProposalStatus, EnrollmentStatus } from "@prisma/client";

export const metadata: Metadata = { title: "活动审核 - 管理后台" };
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "PENDING",  label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ProposalsPage({ searchParams }: PageProps) {
  const { status = "PENDING" } = await searchParams;

  // 获取所有待审核的 分享/展示申请
  const proposals = await cachedQuery(
    `admin:proposals:${status}`,
    () =>
      prisma.meetingProposal.findMany({
        where:   { status: status as ProposalStatus },
        orderBy: { createdAt: "desc" },
        include:  { activity: { select: { id: true, title: true, slug: true } }, user: { select: { id: true, name: true, image: true } } },
      }),
    30
  );

  // 获取公开课的报名（需要分配导师 / 评分）
  const enrollments = await cachedQuery(
    `admin:enrollments:${status}`,
    () =>
      prisma.courseEnrollment.findMany({
        where:    { status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.IN_PROGRESS] } },
        orderBy:  { createdAt: "desc" },
        include:  { activity: { select: { id: true, title: true } }, user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } } },
      }),
    30
  );

  // 获取比赛提交（需要评分）
  const submissions = await cachedQuery(
    `admin:submissions:${status}`,
    () =>
      prisma.competitionSubmission.findMany({
        orderBy: { createdAt: "desc" },
        include:  { activity: { select: { id: true, title: true } }, user: { select: { id: true, name: true } }, project: { select: { id: true, title: true, slug: true } } },
      }),
    30
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>活动审核</h1>
        <a href="/admin/activities" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回活动管理</a>
      </div>

      {/* ── 例会申请 ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>例会 — 分享 / 展示申请</h2>

        {proposals.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无申请</div>
        )}

        <div className="space-y-3">
          {proposals.map(p => (
            <form key={p.id} action={async (f: FormData) => { "use server"; await reviewProposal(p.id, f.get("action") as any, f.get("adminNote") as string || undefined); }}
              className="bg-white rounded-xl border p-4 shadow-sm space-y-3" style={{ borderColor: "#D0DEE8" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold" style={{ color: "#333" }}>{p.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                      分享申请
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      p.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                     "bg-yellow-100 text-yellow-700"
                    }`}>{p.status === "PENDING" ? "待审核" : p.status === "APPROVED" ? "已通过" : "已拒绝"}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#777" }}>
                    活动：<a href={`/activities/${p.activity.slug}`} target="_blank" className="hover:text-[#3388BB]">{p.activity.title}</a>
                    {" · "}申请人：{p.user.name}
                    {" · "}{p.createdAt.toLocaleDateString("zh-CN")}
                  </p>
                  {p.description && <p className="text-sm mt-1" style={{ color: "#555" }}>{p.description}</p>}
                  {p.adminNote && <p className="text-xs mt-1" style={{ color: "#E38043" }}>审核意见：{p.adminNote}</p>}
                </div>
              </div>

              {p.status === "PENDING" && (
                <div className="flex gap-2 items-center flex-wrap">
                  <SubmitButton name="action" value="APPROVED" type="submit"
                    className="btn-primary px-3 py-1.5 text-xs rounded-lg" pendingText="通过中...">通过</SubmitButton>
                  <SubmitButton name="action" value="REJECTED" type="submit"
                    className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: "#EF4444", color: "#EF4444" }} pendingText="拒绝中...">拒绝</SubmitButton>
                  <input name="adminNote" placeholder="审核意见（可选）"
                    className="flex-1 min-w-[120px] rounded-lg border px-3 py-1.5 text-xs placeholder-gray-400"
                    style={{ borderColor: "#D0DEE8" }} />
                </div>
              )}
            </form>
          ))}
        </div>
      </section>

      {/* ── 公开课报名 ─────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>公开课 — 报名 / 评分</h2>
        {enrollments.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无报名记录</div>
        )}
        <div className="space-y-3">
          {enrollments.map(e => (
            <div key={e.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: "#333" }}>{e.user.name}</span>
                <span className="text-xs" style={{ color: "#777" }}>{e.activity.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  e.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                  e.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                                                 "bg-gray-100 text-gray-600"
                }`}>{e.status === "ENROLLED" ? "已报名" : e.status === "IN_PROGRESS" ? "进行中" : "已完成"}</span>
              </div>
              {e.topic && <p className="text-xs mt-1" style={{ color: "#555" }}>选题：{e.topic}</p>}
              {e.mentor && <p className="text-xs" style={{ color: "#777" }}>导师：{e.mentor.name}</p>}
              {e.score !== null && e.score !== undefined && (
                <p className="text-xs font-medium" style={{ color: "#E38043" }}>评分：{e.score}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 比赛提交 ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>比赛 / Game Jam — 作品提交</h2>
        {submissions.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无提交</div>
        )}
        <div className="space-y-3">
          {submissions.map(s => (
            <div key={s.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "#333" }}>{s.user.name}</span>
                  <span className="text-xs" style={{ color: "#777" }}>{s.activity.title}</span>
                  {s.teamName && <span className="text-xs" style={{ color: "#999" }}>队伍：{s.teamName}</span>}
                </div>
                <DeleteSubmissionButton id={s.id} userName={s.user.name} />
              </div>
              {s.submissionUrl && (
                <a href={s.submissionUrl} target="_blank" rel="noreferrer"
                  className="text-xs block mt-1 hover:text-[#3388BB]" style={{ color: "#3388BB" }}>{s.submissionUrl}</a>
              )}
              {s.score !== null && s.score !== undefined && (
                <p className="text-xs font-medium mt-1" style={{ color: "#E38043" }}>评分：{s.score}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
