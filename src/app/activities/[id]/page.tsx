/**
 * 前台 - 活动详情页
 * 根据活动类型动态渲染不同内容
 */

import { Metadata, ResolvingMetadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { ActivityType, ActivityStatus, ProposalType, ProposalStatus, EnrollmentStatus } from "@prisma/client";
import { submitProposal, enrollCourse, submitCompetition } from "@/app/admin/activities/actions";
import { cachedQuery } from "@/lib/db/cache";

const TYPE_LABELS: Record<string, string> = {
  MEETING:    "例会",
  COURSE:     "公开课",
  COMPETITION: "比赛 / Game Jam",
  GENERAL:    "普通活动",
};

const DEFAULT_COVER = "/images/default_pic.png";

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "草稿",
  PUBLISHED: "已发布",
  ARCHIVED:  "已归档",
};

interface PageProps {
  params:  Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const a = await prisma.activity.findUnique({ where: { id }, select: { title: true, summary: true } });
  if (!a) return { title: "活动不存在" };
  return {
    title: `${a.title} - 活动 - 布谷工作室`,
    description: a.summary || a.title,
  };
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params;
  const now = new Date();

  const activity = await cachedQuery(
    `activity:detail:${id}`,
    () =>
      prisma.activity.findUnique({
        where:  { id },
        include: {
          proposals:   { where: { status: ProposalStatus.APPROVED }, include: { user: { select: { id: true, name: true, image: true } } } },
          enrollments: { where: { status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.IN_PROGRESS] } }, include: { user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } } } },
          submissions:  { include: { user: { select: { id: true, name: true, image: true } }, project: { select: { id: true, title: true, slug: true } } } },
        },
      }),
    120,
  );

  if (!activity) notFound();

  const isOngoing   = now >= activity.startTime && now <= activity.endTime;
  const isUpcoming  = now < activity.startTime;
  const isPast       = now > activity.endTime;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      {/* ── 封面图 ──────────────────────────────────── */}
      <div className="mb-6 rounded-xl overflow-hidden aspect-video" style={{ background: "#E6F0F8" }}>
        <img
          src={activity.coverImage || DEFAULT_COVER}
          alt={activity.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* ── 标题区 ──────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E6F0F8", color: "#3388BB" }}>
            {TYPE_LABELS[activity.type] || activity.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activity.status === "PUBLISHED" ? "bg-green-100 text-green-700" :
            activity.status === "DRAFT"      ? "bg-gray-100 text-gray-600" :
                                                       "bg-yellow-100 text-yellow-700"
          }`}>{STATUS_LABELS[activity.status] || activity.status}</span>
          {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">进行中</span>}
          {isUpcoming && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E38043" }}>即将开始</span>}
          {isPast    && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">已结束</span>}
        </div>

        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>{activity.title}</h1>

        <p className="text-sm" style={{ color: "#777" }}>
          📅 {activity.startTime.toLocaleString("zh-CN")} ~ {activity.endTime.toLocaleString("zh-CN")}
          {activity.location ? ` · 📍 ${activity.location}` : ""}
          {activity.meetingUrl ? ` · 🔗 线上` : ""}
          {activity.registrationOpen ? " · ✅ 开放报名" : ""}
        </p>

        {activity.summary && (
          <p className="text-base" style={{ color: "#555" }}>{activity.summary}</p>
        )}
      </div>

      {/* ── 详细描述 ────────────────────────────────── */}
      {activity.description && (
        <div className="prose max-w-none mb-4" style={{ color: "#333" }}
          dangerouslySetInnerHTML={{ __html: activity.description.replace(/\n/g, "<br/>") }} />
      )}

      {/* ── 线上链接 ────────────────────────────────── */}
      {activity.meetingUrl && (
        <div className="mb-6 p-4 rounded-xl border" style={{ borderColor: "#D0DEE8", background: "#F0F8FF" }}>
          <span className="text-sm font-medium" style={{ color: "#25547A" }}>🔗 线上链接：</span>
          <a href={activity.meetingUrl} target="_blank" rel="noreferrer" className="text-sm ml-1 hover:underline" style={{ color: "#3388BB" }}>{activity.meetingUrl}</a>
        </div>
      )}

      {/* ── 根据类型渲染 ──────────────────────────── */}
      {activity.type === "MEETING"    && <MeetingSection activity={activity} isOngoing={isOngoing} isUpcoming={isUpcoming} />}
      {activity.type === "COURSE"     && <CourseSection  activity={activity} isOngoing={isOngoing} isUpcoming={isUpcoming} />}
      {activity.type === "COMPETITION" && <CompetitionSection activity={activity} isOngoing={isOngoing} isUpcoming={isUpcoming} />}
      {activity.type === "GENERAL"    && <GeneralSection activity={activity} />}
    </div>
  );
}

// ── 例会 ───────────────────────────────────────────────────
function MeetingSection({ activity, isOngoing, isUpcoming }: { activity: any; isOngoing: boolean; isUpcoming: boolean }) {
  const proposals = activity.proposals || [];
  return (
    <div className="space-y-6">
      {/* 议程：已通过的申请 */}
      {proposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>📋 议程</h2>
          <div className="space-y-3">
            {proposals.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: "#D0DEE8" }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: "#333" }}>{p.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                    {p.proposalType === "SHARE" ? "分享" : "展示"}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "#777" }}>by {p.user.name}</p>
                {p.description && <p className="text-sm mt-1" style={{ color: "#555" }}>{p.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 申请入口 */}
      {(isOngoing || isUpcoming) && (
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>申请上台</h3>
          <details className="group">
            <summary className="cursor-pointer text-sm hover:text-[#3388BB]" style={{ color: "#555" }}>分享申请</summary>
            <form action={async (f: FormData) => { "use server"; await submitProposal(f); }} className="mt-3 space-y-3">
              <input type="hidden" name="activityId" value={activity.id} />
              <input type="hidden" name="proposalType" value="SHARE" />
              <input name="title" placeholder="分享主题…" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
              <textarea name="description" placeholder="简介（可选）" rows={2} className="w-full rounded-lg border px-3 py-2 text-sm resize-y" style={{ borderColor: "#D0DEE8" }} />
              <button type="submit" className="btn-primary text-sm px-4 py-2 rounded-lg">提交申请</button>
            </form>
          </details>
          <details className="group mt-3">
            <summary className="cursor-pointer text-sm hover:text-[#3388BB]" style={{ color: "#555" }}>展示申请</summary>
            <form action={async (f: FormData) => { "use server"; await submitProposal(f); }} className="mt-3 space-y-3">
              <input type="hidden" name="activityId" value={activity.id} />
              <input type="hidden" name="proposalType" value="SHOWCASE" />
              <input name="title" placeholder="展示内容…" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
              <textarea name="description" placeholder="简介（可选）" rows={2} className="w-full rounded-lg border px-3 py-2 text-sm resize-y" style={{ borderColor: "#D0DEE8" }} />
              <button type="submit" className="btn-primary text-sm px-4 py-2 rounded-lg">提交申请</button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}

// ── 公开课 ─────────────────────────────────────────────────
function CourseSection({ activity, isOngoing, isUpcoming }: { activity: any; isOngoing: boolean; isUpcoming: boolean }) {
  const enrollments = activity.enrollments || [];
  return (
    <div className="space-y-6">
      {/* 报名入口 */}
      {(isOngoing || isUpcoming) && activity.registrationOpen && (
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>📚 报名公开课</h3>
          <form action={async (f: FormData) => { "use server"; await enrollCourse(f); }} className="space-y-3">
            <input type="hidden" name="activityId" value={activity.id} />
            <input name="topic" placeholder="选题（可选）" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
            <button type="submit" className="btn-primary text-sm px-4 py-2 rounded-lg">报名参加</button>
          </form>
        </section>
      )}

      {/* 已报名学员 */}
      {enrollments.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>👨🎓 已报名学员</h3>
          <div className="space-y-2">
            {enrollments.map((e: any) => (
              <div key={e.id} className="bg-white rounded-lg border px-4 py-2 flex items-center gap-3" style={{ borderColor: "#D0DEE8" }}>
                <span className="text-sm font-medium" style={{ color: "#333" }}>{e.user.name}</span>
                {e.topic && <span className="text-xs" style={{ color: "#777" }}>选题：{e.topic}</span>}
                {e.mentor && <span className="text-xs" style={{ color: "#3388BB" }}>导师：{e.mentor.name}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Game Jam / 比赛 ───────────────────────────────────────
function CompetitionSection({ activity, isOngoing, isUpcoming }: { activity: any; isOngoing: boolean; isUpcoming: boolean }) {
  const submissions = activity.submissions || [];
  return (
    <div className="space-y-6">
      {/* 提交入口 */}
      {(isOngoing || isUpcoming) && activity.registrationOpen && (
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>🏆 提交作品</h3>
          <form action={async (f: FormData) => { "use server"; await submitCompetition(f); }} className="space-y-3">
            <input type="hidden" name="activityId" value={activity.id} />
            <input name="teamName" placeholder="队伍名称（可选）" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
            <input name="submissionUrl" type="url" placeholder="https://… 提交链接 *" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
            <textarea name="note" placeholder="备注（可选）" rows={2} className="w-full rounded-lg border px-3 py-2 text-sm resize-y" style={{ borderColor: "#D0DEE8" }} />
            <button type="submit" className="btn-primary text-sm px-4 py-2 rounded-lg">提交作品</button>
          </form>
        </section>
      )}

      {/* 排行榜 */}
      {submissions.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>🏅 作品列表</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {submissions
              .sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1))
              .map((s: any, idx: number) => (
                <div key={s.id} className="bg-white rounded-xl border p-4 space-y-1" style={{ borderColor: "#D0DEE8" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: idx < 3 ? "#FFF3E0" : "#F0F5F9", color: idx < 3 ? "#E38043" : "#999" }}>
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-sm" style={{ color: "#333" }}>{s.user.name}</span>
                    {s.teamName && <span className="text-xs" style={{ color: "#777" }}>「{s.teamName}」</span>}
                  </div>
                  {s.submissionUrl && (
                    <a href={s.submissionUrl} target="_blank" rel="noreferrer" className="text-xs hover:text-[#3388BB]" style={{ color: "#3388BB" }}>{s.submissionUrl}</a>
                  )}
                  {s.score !== null && s.score !== undefined && (
                    <p className="text-xs font-medium" style={{ color: "#E38043" }}>评分：{s.score}</p>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── 普通活动 ─────────────────────────────────────────────
function GeneralSection({ activity }: { activity: any }) {
  return (
    <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
      <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>活动说明</h3>
      <p className="text-sm" style={{ color: "#555" }}>
        请按时参加活动，如有疑问请联系管理员。
      </p>
    </div>
  );
}
