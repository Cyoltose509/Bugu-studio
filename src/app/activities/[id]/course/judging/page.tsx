import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddJudgeForm } from "@/components/activities/judging/AddJudgeForm";
import { RemoveJudgeButton } from "@/components/activities/judging/RemoveJudgeButton";
import { SubmitCourseScoreForm } from "@/components/activities/judging/SubmitCourseScoreForm";
import UserAvatar from "@/components/ui/UserAvatar";

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
  const activityId = (await params).id;
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
        <p className="text-lg font-semibold" style={{ color: "#25547A" }}>此页面仅适用于公开课活动</p>
        <Link href={`/activities/${activityId}`} className="text-sm mt-4 inline-block hover:underline" style={{ color: "#3388BB" }}>
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
        <p className="text-lg font-semibold" style={{ color: "#25547A" }}>仅评委和管理员可访问评审页</p>
        <Link href={`/activities/${activityId}`} className="text-sm mt-4 inline-block hover:underline" style={{ color: "#3388BB" }}>
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
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
      </div>

      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#25547A" }}>📚 讲题评审</h1>
        <p className="text-sm mt-1" style={{ color: "#777" }}>{activity.title}</p>
      </div>

      {/* 评委管理（管理员） */}
      {isAdmin && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评委管理</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {jamJudges.map(j => (
              <span key={j.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full" style={{ background: "#F0F6FA" }}>
                <UserAvatar src={j.user.image} name={j.user.name} size={24} />
                <span style={{ color: "#25547A" }}>{j.user.name}</span>
                <RemoveJudgeButton activityId={activityId} judgeId={j.id} />
              </span>
            ))}
          </div>
          <AddJudgeForm activityId={activityId} existingJudgeIds={jamJudges.map(j => j.userId)} />
        </div>
      )}

      {/* 参赛队伍 & 讲题 */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold" style={{ color: "#25547A" }}>👥 参赛队伍（{rankedTeams.length}）</h2>
            <p className="text-xs mt-1" style={{ color: "#999" }}>
              点击展开查看队伍详情、讲题并评分
            </p>
          </div>
        </div>

        {rankedTeams.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "#999" }}>暂无参赛队伍</p>
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
                  <summary className="list-none cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[#F8FAFB]"
                    style={{ borderColor: idx === 0 && team.avgScore > 0 ? "#FFCC80" : hasTopic ? "#88C232" : "#D0DEE8" }}>
                    {/* 序号 */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "#E6F0F8", color: "#25547A" }}>
                      {idx + 1}
                    </div>

                    {/* 队伍名 + 讲题预览 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate" style={{ color: "#25547A" }}>{team.name}</span>
                        {!hasTopic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E38043" }}>
                            未设定讲题
                          </span>
                        )}
                      </div>
                      {team.topic && (
                        <p className="text-xs truncate mt-0.5" style={{ color: "#777" }}>{team.topic}</p>
                      )}
                    </div>

                    {/* 排名&均分 */}
                    {team.avgScore > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold" style={{ color: idx === 0 ? "#E38043" : "#3388BB" }}>{team.avgScore}</div>
                        <div className="text-[10px]" style={{ color: "#999" }}>
                          #{idx + 1} · {scores.length}评
                        </div>
                      </div>
                    )}

                    {/* 打分状态指示 */}
                    <div className="text-xs shrink-0 text-right" style={{ color: myScore ? "#2E7D32" : "#999" }}>
                      {myScore ? "✅ 已评分" : "📝 待评分"}
                    </div>

                    {/* 成员数 + 队长 */}
                    <div className="text-right shrink-0">
                      <div className="text-xs" style={{ color: "#999" }}>{team._count.members} 人</div>
                      {leader && (
                        <div className="text-xs mt-0.5" style={{ color: "#E38043" }}>👑 {leader.user.name}</div>
                      )}
                    </div>

                    <span className="text-sm shrink-0" style={{ color: "#ccc" }}>▸</span>
                  </summary>

                  {/* 展开详情 */}
                  <div className="mx-1 mt-1 rounded-b-xl border border-t-0 p-5" style={{ borderColor: "#D0DEE8", background: "#FAFBFC" }}>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* 左侧：讲题详情 */}
                      <div className="lg:col-span-3 space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>📝 讲题内容</h3>
                          {team.topic ? (
                            <div className="p-4 rounded-lg" style={{ background: "#FFFDF7", border: "1px solid #FFF3E0" }}>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>{team.topic}</p>
                            </div>
                          ) : (
                            <p className="text-sm py-4 text-center" style={{ color: "#999" }}>该队伍尚未设定讲题</p>
                          )}
                        </div>
                      </div>

                      {/* 右侧：队伍成员 */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-xl p-4" style={{ background: "#F0F5FA" }}>
                          <h3 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>👥 队伍成员（{team._count.members} 人）</h3>
                          <div className="space-y-2">
                            {team.members.map(m => (
                              <div key={m.user.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "#fff" }}>
                                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                                <span className="text-sm flex-1" style={{ color: "#333" }}>{m.user.name}</span>
                                {m.role === "LEADER" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#FFF3E0", color: "#E38043" }}>
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
                    <div className="my-5 border-t" style={{ borderColor: "#D0DEE8" }} />

                    {/* 已有评分 */}
                    {scores.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>🏆 评委评分（{scores.length}）</h3>
                        {scores.map(sc => {
                          const c = (sc.criteria || {}) as Record<string, number>;
                          return (
                            <div key={sc.id} className="text-xs p-3 rounded flex flex-wrap items-center gap-x-4 gap-y-1"
                              style={{ background: "#fff", border: "1px solid #E6F0F8" }}>
                              <span className="font-medium" style={{ color: "#555" }}>{sc.judge.name}</span>
                              <div className="flex gap-3">
                                <span>📝 {c.content ?? "-"}</span>
                                <span>🎤 {c.delivery ?? "-"}</span>
                                <span>📋 {c.preparation ?? "-"}</span>
                              </div>
                              <span className="font-bold" style={{ color: "#E38043" }}>{sc.totalScore} 分</span>
                              {sc.comment && (
                                <span className="w-full italic" style={{ color: "#999" }}>"{sc.comment}"</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 评分表单 */}
                    {canAccess && team.topic && (
                      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E6F0F8" }}>
                        <SubmitCourseScoreForm
                          activityId={activityId}
                          teamId={team.id}
                          myScore={myScore}
                        />
                      </div>
                    )}

                    {/* 无讲题时提示 */}
                    {!team.topic && (
                      <div className="rounded-lg p-4 text-center" style={{ background: "#F0F5FA" }}>
                        <p className="text-xs" style={{ color: "#999" }}>
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
