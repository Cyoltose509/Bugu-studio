/**
 * 前台 - 活动详情页
 * 根据活动类型动态渲染不同内容
 */

import { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { ActivityStatus, ProposalType, ProposalStatus } from "@prisma/client";
import SubmitProposalForm from "./SubmitProposalForm";
import DeleteProposalButton from "./DeleteProposalButton";
import ReviewProposalForm from "./ReviewProposalForm";
import { DisbandTeamButton } from "./game-jam/DisbandTeamButton";
import { LeaveTeamButton } from "./game-jam/LeaveTeamButton";
import { InvitationButtons } from "./game-jam/InvitationButtons";
import { CreateTeamForm } from "./game-jam/CreateTeamForm";
import EditTopicForm from "./game-jam/EditTopicForm";
import SubmitToWorksButton from "./game-jam/submit/SubmitToWorksButton";
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

// React.cache() 去重：generateMetadata 和页面组件共用同一查询
const getActivity = cache(async (id: string) => {
  return cachedQuery(
    `activity:detail:${id}`,
    () =>
      prisma.activity.findUnique({
        where:  { id },
        include: {
          proposals:   { where: { status: ProposalStatus.APPROVED }, include: { user: { select: { id: true, name: true, image: true } } } },
          submissions:  { include: { user: { select: { id: true, name: true, image: true } }, project: { select: { id: true, title: true, slug: true } } } },
          jamTeams: {
            include: {
              members: { include: { user: { select: { id: true, name: true, image: true } } } },
              _count: { select: { members: true } },
            },
          },
          jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
          jamSubmissions: {
            select: {
              id: true,
              title: true,
              projectId: true,
              team: { select: { name: true } },
              scores: { select: { totalScore: true } },
            },
          },
        },
      }),
    120,
  );
});

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const a = await getActivity(id);
  if (!a) return { title: "活动不存在" };
  return {
    title: `${a.title} - 活动 - 布谷工作室`,
    description: (a as any).summary || a.title,
  };
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;
  const now = new Date();

  const activity = await getActivity(id);

  if (!activity) notFound();

  const isOngoing   = now >= activity.startTime && now <= activity.endTime;
  const isUpcoming  = now < activity.startTime;
  const isPast       = now > activity.endTime;

  // 查询当前用户在此活动的分享申请（用于限制重复提交）
  const userProposal = activity.type === "MEETING" && session?.user
    ? await prisma.meetingProposal.findFirst({
        where: { activityId: id, userId: session.user.id },
      })
    : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      {/* ── 封面图 ──────────────────────────────────── */}
      <div className="mb-6 rounded-xl overflow-hidden relative aspect-video" style={{ background: "#E6F0F8" }}>
        <Image
          src={activity.coverImage || DEFAULT_COVER}
          alt={activity.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 896px"
          priority
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
      {activity.type === "MEETING"    && <MeetingSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} userProposal={userProposal} />}
      {activity.type === "COURSE"     && <CourseSection  activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} />}
      {activity.type === "COMPETITION" && <CompetitionSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} />}
      {activity.type === "GENERAL"    && <GeneralSection activity={activity} />}
    </div>
  );
}

// ── 头像 ────────────────────────────────────────────────
function AvatarImg({ user }: { user: { name?: string | null; image?: string | null } }) {
  const initial = (user.name || "?")[0];
  if (user.image) {
    return <img src={user.image} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={{ background: "#E38043" }}>
      {initial}
    </div>
  );
}

// ── 例会 ───────────────────────────────────────────────────
async function MeetingSection({
  activity, session, isOngoing, isUpcoming, userProposal,
}: { activity: any; session: any; isOngoing: boolean; isUpcoming: boolean; userProposal: any }) {
  const proposals = activity.proposals || [];
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  // 管理员获取待审核的分享申请
  let pendingProposals: any[] = [];
  if (isAdmin) {
    pendingProposals = await prisma.meetingProposal.findMany({
      where: { activityId: activity.id, status: ProposalStatus.PENDING },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, image: true } } },
    });
  }

  return (
    <div className="space-y-6">
      {/* ── 管理员审核待处理的申请 ──────────────── */}
      {isAdmin && pendingProposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3" style={{ color: "#E38043" }}>⏳ 待审核分享申请</h2>
          <div className="space-y-3">
            {pendingProposals.map((p: any) => (
              <ReviewProposalForm
                key={p.id}
                proposalId={p.id}
                title={p.title}
                userName={p.user.name}
                createdAt={p.createdAt.toLocaleDateString("zh-CN")}
                description={p.description}
              />
            ))}
          </div>
        </section>
      )}

      {proposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>📋 议程</h2>
          <div className="space-y-3">
            {proposals.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: "#D0DEE8" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "#333" }}>{p.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                        {p.proposalType === "SHARE" ? "分享" : "展示"}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#777" }}>by {p.user.name}</p>
                    {p.description && <p className="text-sm mt-1" style={{ color: "#555" }}>{p.description}</p>}
                  </div>
                  {isAdmin && (
                    <DeleteProposalButton proposalId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(isOngoing || isUpcoming) && (
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>📢 报名分享</h3>
          {userProposal ? (
            /* 已提交申请 — 显示状态 */
            <div className="rounded-lg p-4" style={{ background: "#F0F6FA" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm" style={{ color: "#333" }}>{userProposal.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={
                  userProposal.status === "APPROVED"
                    ? { background: "#E6F0F8", color: "#2E7D32" }
                    : userProposal.status === "REJECTED"
                    ? { background: "#FFEBEE", color: "#C62828" }
                    : { background: "#FFF8E1", color: "#F57F17" }
                }>
                  {userProposal.status === "APPROVED" ? "已通过" : userProposal.status === "REJECTED" ? "已拒绝" : "审核中"}
                </span>
              </div>
              {userProposal.description && <p className="text-xs" style={{ color: "#777" }}>{userProposal.description}</p>}
              {userProposal.status === "REJECTED" && userProposal.adminNote && (
                <p className="text-xs mt-1" style={{ color: "#C62828" }}>审核意见：{userProposal.adminNote}</p>
              )}
            </div>
          ) : (
            /* 未提交 — 显示表单 */
            <>
              <p className="text-xs mb-3" style={{ color: "#777" }}>报名分享你的主题，经管理员审核后将列入议程。每人限提交一份。</p>
              <SubmitProposalForm activityId={activity.id} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ── 公开课（队伍制）─────────────────────────────────────────────
async function CourseSection({
  activity, session, isOngoing, isUpcoming, isPast,
}: { activity: any; session: any; isOngoing: boolean; isUpcoming: boolean; isPast: boolean }) {
  const activityId = activity.id;
  const userId = session?.user?.id;
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  const myTeam = activity.jamTeams?.find((t: any) =>
    t.members.some((m: any) => m.userId === userId)
  ) || null;

  const isJudge = activity.jamJudges?.some((j: any) => j.userId === userId);

  let myInvitations: any[] = [];
  if (userId && !myTeam) {
    myInvitations = await prisma.jamTeamInvitation.findMany({
      where: { inviteeId: userId, status: "PENDING", team: { activityId } },
      include: { team: true, inviter: { select: { name: true } } },
    });
  }

  const jamJudges = activity.jamJudges || [];
  const jamTeams = activity.jamTeams || [];

  return (
    <div className="space-y-6" id="jam">
      {/* ── 阶段状态 & 课题 ──────────────────── */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#25547A" }}>📚 公开课</h2>
            <p className="text-sm mt-1" style={{ color: "#777" }}>
              {isUpcoming && "报名组队中 · 课程尚未开始"}
              {isOngoing && "课程进行中 · 组队报名 · 提交讲题"}
              {isPast && "课程已结束 · 评审阶段"}
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/activities/${activityId}/game-jam/judging`}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "#D0DEE8", color: "#555" }}
            >管理评审</Link>
          )}
        </div>

        {activity.theme && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: "#FFFDF7", border: "1px solid #FFF3E0" }}>
            <p className="text-sm font-semibold" style={{ color: "#E38043" }}>📋 课题</p>
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "#555" }}>{activity.theme}</p>
          </div>
        )}
      </div>

      {/* ── 我的队伍 ──────────────────────────── */}
      {myTeam ? (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "#25547A" }}>我的队伍：{myTeam.name}</h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams/${myTeam.id}`}
              className="text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: "#3388BB" }}
            >管理队伍</Link>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {myTeam.members.map((m: any) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#F0F6FA", color: "#25547A" }}>
                <AvatarImg user={m.user} />
                {m.user.name}
                {m.role === "LEADER" && <span style={{ color: "#E38043" }}>👑</span>}
              </span>
            ))}
          </div>

          {/* 讲题设置（队长+进行中/未开始） */}
          {(isUpcoming || isOngoing) && myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) && (
            <div className="p-3 rounded-lg mb-3" style={{ background: "#F0F6FA" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "#25547A" }}>📝 队伍讲题</p>
              <EditTopicForm teamId={myTeam.id} activityId={activityId} currentTopic={myTeam.topic} />
            </div>
          )}
          {myTeam.topic && !myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) && (
            <div className="p-3 rounded-lg mb-3" style={{ background: "#F0F6FA" }}>
              <p className="text-xs" style={{ color: "#25547A" }}>📝 讲题：<span className="font-medium">{myTeam.topic}</span></p>
            </div>
          )}

          {/* 退出/解散 */}
          {(isUpcoming || isOngoing) && (
            <div className="flex gap-2">
              {myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) ? (
                <DisbandTeamButton teamId={myTeam.id} activityId={activityId} />
              ) : (
                <LeaveTeamButton teamId={myTeam.id} activityId={activityId} />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>👥 组队报名</h3>

          {myInvitations.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium" style={{ color: "#E38043" }}>你收到的队伍邀请：</p>
              {myInvitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#F0F6FA" }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#25547A" }}>{inv.team.name}</span>
                    <span className="text-xs ml-2" style={{ color: "#999" }}>来自 {inv.inviter.name}</span>
                  </div>
                  <InvitationButtons invitationId={inv.id} activityId={activityId} />
                </div>
              ))}
            </div>
          )}

          {userId && !myTeam && (isUpcoming || isOngoing) && (
            <div className="flex gap-3 flex-wrap">
              <Link
                href={`/activities/${activityId}/game-jam/teams`}
                className="text-sm px-4 py-2 rounded-lg text-white"
                style={{ background: "#3388BB" }}
              >查看队伍</Link>
              <CreateTeamForm activityId={activityId} />
            </div>
          )}
        </div>
      )}

      {/* ── 所有队伍 ───────────────────────────── */}
      {jamTeams.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "#25547A" }}>
              👥 参赛队伍（{jamTeams.length}）
            </h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams`}
              className="text-xs hover:underline"
              style={{ color: "#3388BB" }}
            >查看全部 →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {jamTeams.map((team: any) => (
              <Link
                key={team.id}
                href={`/activities/${activityId}/game-jam/teams/${team.id}`}
                className="p-3 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ border: `2px solid ${myTeam?.id === team.id ? "#3388BB" : "#D0DEE8"}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm truncate" style={{ color: "#25547A" }}>{team.name}</span>
                  {myTeam?.id === team.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white shrink-0 ml-1" style={{ background: "#3388BB", fontSize: "10px" }}>我的</span>
                  )}
                </div>
                {team.topic && (
                  <p className="text-xs truncate mb-1" style={{ color: "#E38043" }}>📝 {team.topic}</p>
                )}
                <div className="flex items-center gap-2 text-xs" style={{ color: "#999" }}>
                  <span>👑 {team.members.find((m: any) => m.role === "LEADER")?.user?.name || "?"}</span>
                  <span>· {team._count.members} 人</span>
                </div>
                <div className="flex mt-2 gap-1">
                  {team.members.slice(0, 5).map((m: any) => (
                    <AvatarImg key={m.id} user={m.user} />
                  ))}
                  {team._count.members > 5 && (
                    <span className="text-xs self-center" style={{ color: "#999" }}>+{team._count.members - 5}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 评委列表 ───────────────────────────── */}
      {jamJudges.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评委</h3>
          <div className="flex flex-wrap gap-2">
            {jamJudges.map((j: any) => (
              <span key={j.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full" style={{ background: "#F0F6FA", color: "#25547A" }}>
                <AvatarImg user={j.user} /> {j.user.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 评审入口 ──────────────────────────── */}
      {isJudge && isPast && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/judging`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #3388BB, #55AADD)" }}
          >🎯 进入评审面板</Link>
        </div>
      )}

      {/* ── 结果页入口 ──────────────────────────── */}
      {activity.status === "ARCHIVED" && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/results`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #E38043, #FFB347)" }}
          >🏆 查看评分结果</Link>
        </div>
      )}
    </div>
  );
}

// ── Game Jam / 比赛 ───────────────────────────────────────
async function CompetitionSection({
  activity, session, isOngoing, isUpcoming, isPast,
}: {
  activity: any; session: any;
  isOngoing: boolean; isUpcoming: boolean; isPast: boolean;
}) {
  const activityId = activity.id;
  const userId = session?.user?.id;
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";
  const now = new Date();
  const themeRevealed = activity.themeRevealedAt ? now >= activity.themeRevealedAt : isOngoing || isPast;

  const myTeam = activity.jamTeams?.find((t: any) =>
    t.members.some((m: any) => m.userId === userId)
  ) || null;

  const isJudge = activity.jamJudges?.some((j: any) => j.userId === userId);

  let myInvitations: any[] = [];
  if (userId && !myTeam) {
    myInvitations = await prisma.jamTeamInvitation.findMany({
      where: { inviteeId: userId, status: "PENDING", team: { activityId } },
      include: { team: true, inviter: { select: { name: true } } },
    });
  }

  const submissions = activity.submissions || [];
  const jamSubmissions = activity.jamSubmissions || [];
  const jamJudges = activity.jamJudges || [];
  const jamTeams = activity.jamTeams || [];

  return (
    <div className="space-y-6" id="jam">
      {/* ── 阶段状态 & 题目 ──────────────────── */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#25547A" }}>🏆 Game Jam</h2>
            <p className="text-sm mt-1" style={{ color: "#777" }}>
              {isUpcoming && "报名组队中 · 比赛尚未开始"}
              {isOngoing && "比赛进行中 · 组队参赛 · 提交作品"}
              {isPast && "比赛已结束 · 评审阶段"}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href={`/activities/${activityId}/game-jam/judging`}
                className="text-xs px-3 py-1.5 rounded-lg border"
                style={{ borderColor: "#D0DEE8", color: "#555" }}
              >
                管理评审
              </Link>
            )}
          </div>
        </div>

        {/* 题目 */}
        {activity.theme && themeRevealed && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: "#FFFDF7", border: "1px solid #FFF3E0" }}>
            <p className="text-sm font-semibold" style={{ color: "#E38043" }}>📋 比赛题目</p>
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "#555" }}>{activity.theme}</p>
          </div>
        )}
      </div>

      {/* ── 我的队伍 ──────────────────────────── */}
      {myTeam ? (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "#25547A" }}>我的队伍：{myTeam.name}</h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams/${myTeam.id}`}
              className="text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: "#3388BB" }}
            >
              管理队伍
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {myTeam.members.map((m: any) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#F0F6FA", color: "#25547A" }}>
                <AvatarImg user={m.user} />
                {m.user.name}
                {m.role === "LEADER" && <span style={{ color: "#E38043" }}>👑</span>}
              </span>
            ))}
            {myTeam._count.members < 5 && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ color: "#999", border: "1px dashed #D0DEE8" }}>
                + 空位
              </span>
            )}
          </div>

          {/* 提交作品 & 解散 */}
          {(isUpcoming || isOngoing) && (
            <div className="mt-4 flex gap-2">
              {myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) ? (
                <DisbandTeamButton teamId={myTeam.id} activityId={activityId} />
              ) : (
                <LeaveTeamButton teamId={myTeam.id} activityId={activityId} />
              )}
              {isOngoing && (
                <Link
                  href={`/activities/${activityId}/game-jam/submit`}
                  className="text-xs px-3 py-1.5 rounded-lg text-white"
                  style={{ background: "#25547A" }}
                >
                  {jamSubmissions.some((s: any) => s.teamId === myTeam.id) ? "修改作品" : "提交作品"}
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>👥 组队参赛</h3>

          {/* 待处理邀请 */}
          {myInvitations.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium" style={{ color: "#E38043" }}>你收到的队伍邀请：</p>
              {myInvitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#F0F6FA" }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#25547A" }}>{inv.team.name}</span>
                    <span className="text-xs ml-2" style={{ color: "#999" }}>来自 {inv.inviter.name}</span>
                  </div>
                  <InvitationButtons invitationId={inv.id} activityId={activityId} />
                </div>
              ))}
            </div>
          )}

          {userId && !myTeam && (isUpcoming || isOngoing) && (
            <div className="flex gap-3 flex-wrap">
              <Link
                href={`/activities/${activityId}/game-jam/teams`}
                className="text-sm px-4 py-2 rounded-lg text-white"
                style={{ background: "#3388BB" }}
              >
                查看队伍
              </Link>
              <CreateTeamForm activityId={activityId} />
            </div>
          )}
        </div>
      )}

      {/* ── 所有参赛队伍 ───────────────────────── */}
      {jamTeams.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "#25547A" }}>
              👥 参赛队伍（{jamTeams.length}）
            </h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams`}
              className="text-xs hover:underline"
              style={{ color: "#3388BB" }}
            >
              查看全部 →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {jamTeams.map((team: any) => (
              <Link
                key={team.id}
                href={`/activities/${activityId}/game-jam/teams/${team.id}`}
                className="p-3 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ border: `2px solid ${myTeam?.id === team.id ? "#3388BB" : "#D0DEE8"}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm truncate" style={{ color: "#25547A" }}>{team.name}</span>
                  {myTeam?.id === team.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white shrink-0 ml-1" style={{ background: "#3388BB", fontSize: "10px" }}>我的</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "#999" }}>
                  <span>👑 {team.members.find((m: any) => m.role === "LEADER")?.user?.name || "?"}</span>
                  <span>· {team._count.members} 人</span>
                </div>
                <div className="flex mt-2 gap-1">
                  {team.members.slice(0, 5).map((m: any) => (
                    <AvatarImg key={m.id} user={m.user} />
                  ))}
                  {team._count.members > 5 && (
                    <span className="text-xs self-center" style={{ color: "#999" }}>+{team._count.members - 5}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 评委列表 ───────────────────────────── */}
      {jamJudges.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评委</h3>
          <div className="flex flex-wrap gap-2">
            {jamJudges.map((j: any) => (
              <span key={j.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full" style={{ background: "#F0F6FA", color: "#25547A" }}>
                <AvatarImg user={j.user} /> {j.user.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 参赛作品 ───────────────────────────── */}
      {(isPast || isAdmin || isJudge) && jamSubmissions.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎮 参赛作品（{jamSubmissions.length}）</h3>
          <div className="grid gap-3">
            {jamSubmissions.map((sub: any) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ border: "1px solid #D0DEE8" }}
              >
                <Link
                  href={`/activities/${activityId}/game-jam/judging`}
                  className="flex-1 min-w-0"
                >
                  <span className="text-sm font-medium" style={{ color: "#25547A" }}>{sub.title}</span>
                  <span className="text-xs ml-2" style={{ color: "#999" }}>— {sub.team?.name || "未知队伍"}</span>
                </Link>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {sub.projectId ? (
                    <Link
                      href={`/works/${sub.projectId}`}
                      target="_blank"
                      className="text-xs hover:underline"
                      style={{ color: "#3388BB" }}
                    >
                      📚 作品页 →
                    </Link>
                  ) : (
                    <SubmitToWorksButton
                      activityId={activityId}
                      submissionId={sub.id}
                      title={sub.title}
                    />
                  )}
                  <div className="text-right min-w-[60px]">
                    {sub.scores.length > 0 ? (
                      <span className="text-sm font-semibold" style={{ color: "#E38043" }}>
                        {Math.round(sub.scores.reduce((a: number, b: any) => a + b.totalScore, 0) / sub.scores.length)} 分
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#999" }}>待评分</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 结果页入口 ──────────────────────────── */}
      {activity.status === "ARCHIVED" && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/results`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #E38043, #FFB347)" }}
          >🏆 查看比赛结果</Link>
        </div>
      )}

      {/* ── 评委入口 ────────────────────────────── */}
      {isJudge && isPast && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/judging`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #3388BB, #55AADD)" }}
          >🎯 进入评审面板</Link>
        </div>
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
