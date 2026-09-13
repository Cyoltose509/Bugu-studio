import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddJudgeForm } from "@/components/activities/judging/AddJudgeForm";
import { RemoveJudgeButton } from "@/components/activities/judging/RemoveJudgeButton";
import { SubmitCourseScoreForm } from "@/components/activities/judging/SubmitCourseScoreForm";
import UserAvatar from "@/components/ui/UserAvatar";
import { resolveActivityId } from "@/lib/activities/resolve";

async function ensureAdminJudges(activityId: string) {
  const adminUsers = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      NOT: { member: { graduated: true } },
    },
    select: { id: true },
  });
  if (adminUsers.length === 0) return;

  const existingJudges = await prisma.jamJudge.findMany({
    where: { activityId },
    select: { userId: true },
  });
  const existingIds = new Set(existingJudges.map(j => j.userId));

  const toAdd = adminUsers.filter(u => !existingIds.has(u.id));
  if (toAdd.length > 0) {
    await prisma.jamJudge.createMany({
      data: toAdd.map(u => ({ activityId, userId: u.id })),
      skipDuplicates: true,
    });
  }
}

export default async function CourseJudgingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const activityId = await resolveActivityId((await params).id);
  if (!activityId) notFound();
  const currentUserId = session?.user?.id;

  if (session?.user) {
    const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
    if (isAdmin) {
      await ensureAdminJudges(activityId);
    }
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
      jamTeams: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, image: true } } },
          },
          _count: { select: { members: true } },
          courseScores: {
            include: { judge: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!activity) notFound();

  // 仅 COURSE 活动可用
  if (activity.type !== "COURSE") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-brand-navy">此页面仅适用于公开课活动</p>
        <Link href={`/activities/${activityId}`} className="text-sm mt-4 inline-block hover:underline text-brand-blue">
          ← 返回活动
        </Link>
      </div>
    );
  }

  const isJudge = activity.jamJudges.some(j => j.userId === currentUserId);
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";
  const canAccess = isAdmin || isJudge;

  if (!canAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-brand-navy">仅评委和管理员可访问评审页</p>
        <Link href={`/activities/${activityId}`} className="text-sm mt-4 inline-block hover:underline text-brand-blue">
          ← 返回活动
        </Link>
      </div>
    );
  }

  const jamTeams = activity.jamTeams || [];
  const jamJudges = activity.jamJudges || [];

  // 计算排名
  const rankedTeams = jamTeams
    .map(team => {
      const scores = team.courseScores || [];
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b.totalScore, 0) / scores.length)
        : 0;
      return { ...team, avgScore };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline text-brand-text-muted">
          ← 返回活动
        </Link>
      </div>

      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-navy">📚 讲题评审</h1>
        <p className="text-sm mt-1 text-brand-text-secondary">{activity.title}</p>
      </div>

      {/* 评委管理（管理员） */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mb-6">
          <h2 className="font-semibold mb-3 text-brand-navy">🎯 评委管理</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {jamJudges.map(j => (
              <span key={j.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-[#F0F6FA]">
                <UserAvatar src={j.user.image} name={j.user.name} size={24} />
                <span className="text-brand-navy">{j.user.name}</span>
                <RemoveJudgeButton activityId={activityId} judgeId={j.id} />
              </span>
            ))}
          </div>
          <AddJudgeForm activityId={activityId} existingJudgeIds={jamJudges.map(j => j.userId)} />
        </div>
      )}

      {/* 参赛队伍 & 讲题 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-brand-navy">👥 参赛队伍（{rankedTeams.length}）</h2>
            <p className="text-xs mt-1 text-brand-text-muted">
              点击展开查看队伍详情、讲题并评分
            </p>
          </div>
        </div>

        {rankedTeams.length === 0 ? (
          <p className="text-sm py-8 text-center text-brand-text-muted">暂无参赛队伍</p>
        ) : (
          <div className="space-y-3">
            {rankedTeams.map((team, idx) => {
              const leader = team.members.find(m => m.role === "LEADER");
              const hasTopic = !!team.topic;
              const myScore = team.courseScores.find(s => s.judgeId === currentUserId);
              const scores = team.courseScores || [];

              return (
                <details key={team.id} className="group">
                  {/* 摘要行 */}
                  <summary className={`list-none cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[#F8FAFB] ${
                    idx === 0 && team.avgScore > 0 ? "border-[#FFCC80]" : hasTopic ? "border-brand-green" : "border-brand-border-subtle"
                  }`}>
                    {/* 序号 */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-brand-surface text-brand-navy">
                      {idx + 1}
                    </div>

                    {/* 队伍名 + 讲题预览 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-brand-navy">{team.name}</span>
                        {!hasTopic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFF3E0] text-brand-orange">
                            未设定讲题
                          </span>
                        )}
                      </div>
                      {team.topic && (
                        <p className="text-xs truncate mt-0.5 text-brand-text-secondary">{team.topic}</p>
                      )}
                    </div>

                    {/* 排名&均分 */}
                    {team.avgScore > 0 && (
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${idx === 0 ? "text-brand-orange" : "text-brand-blue"}`}>{team.avgScore}</div>
                        <div className="text-[10px] text-brand-text-muted">
                          #{idx + 1} · {scores.length}评
                        </div>
                      </div>
                    )}

                    {/* 打分状态指示 */}
                    <div className={`text-xs shrink-0 text-right ${myScore ? "text-[var(--ui-text-green)]" : "text-brand-text-muted"}`}>
                      {myScore ? "✅ 已评分" : "📝 待评分"}
                    </div>

                    {/* 成员数 + 队长 */}
                    <div className="text-right shrink-0">
                      <div className="text-xs text-brand-text-muted">{team._count.members} 人</div>
                      {leader && (
                        <div className="text-xs mt-0.5 text-brand-orange">👑 {leader.user.name}</div>
                      )}
                    </div>

                    <span className="text-sm shrink-0 text-[#ccc]">▸</span>
                  </summary>

                  {/* 展开详情 */}
                  <div className="mx-1 mt-1 rounded-b-xl border border-brand-border-subtle border-t-0 p-5 bg-muted">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* 左侧：讲题详情 */}
                      <div className="lg:col-span-3 space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold mb-3 text-brand-navy">📝 讲题内容</h3>
                          {team.topic ? (
                            <div className="p-4 rounded-lg bg-[#FFFDF7] border border-[#FFF3E0]">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed text-brand-text-body">{team.topic}</p>
                            </div>
                          ) : (
                            <p className="text-sm py-4 text-center text-brand-text-muted">该队伍尚未设定讲题</p>
                          )}
                        </div>
                      </div>

                      {/* 右侧：队伍成员 */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-xl p-4 bg-brand-surface-page">
                          <h3 className="text-sm font-semibold mb-3 text-brand-navy">👥 队伍成员（{team._count.members} 人）</h3>
                          <div className="space-y-2">
                            {team.members.map(m => (
                              <div key={m.user.id} className="flex items-center gap-2 p-2 rounded-lg bg-card">
                                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                                <span className="text-sm flex-1 text-brand-text-heading">{m.user.name}</span>
                                {m.role === "LEADER" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF3E0] text-brand-orange">
                                    队长
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="my-5 border-t border-brand-border-subtle" />

                    {/* 已有评分 */}
                    {scores.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <h3 className="text-sm font-semibold mb-2 text-brand-navy">🏆 评委评分（{scores.length}）</h3>
                        {scores.map(sc => {
                          const c = (sc.criteria || {}) as Record<string, number>;
                          return (
                            <div key={sc.id} className="text-xs p-3 rounded flex flex-wrap items-center gap-x-4 gap-y-1 bg-card border border-brand-surface">
                              <span className="font-medium text-brand-text-body">{sc.judge.name}</span>
                              <div className="flex gap-3">
                                <span>📝 {c.content ?? "-"}</span>
                                <span>🎤 {c.delivery ?? "-"}</span>
                                <span>📋 {c.preparation ?? "-"}</span>
                              </div>
                              <span className="font-bold text-brand-orange">{sc.totalScore} 分</span>
                              {sc.comment && (
                                <span className="w-full italic text-brand-text-muted">"{sc.comment}"</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 评分表单 */}
                    {canAccess && team.topic && (
                      <div className="rounded-xl p-4 bg-card border border-brand-surface">
                        <SubmitCourseScoreForm
                          activityId={activityId}
                          teamId={team.id}
                          myScore={myScore}
                        />
                      </div>
                    )}

                    {/* 无讲题时提示 */}
                    {!team.topic && (
                      <div className="rounded-lg p-4 text-center bg-brand-surface-page">
                        <p className="text-xs text-brand-text-muted">
                          ⚠️ 该队伍尚未设定讲题，无法评分
                        </p>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
