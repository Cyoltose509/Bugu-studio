import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createTeam, applyToTeam, handleInvitation, disbandTeam } from "./actions";

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

export default async function GameJamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const activityId = (await params).id;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamTeams: {
        include: {
          members: { include: { user: { select: { id: true, name: true, image: true } } } },
          _count: { select: { members: true } },
        },
      },
      jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
      jamSubmissions: {
        include: {
          team: { select: { name: true } },
          scores: { select: { totalScore: true } },
        },
      },
    },
  });

  if (!activity || activity.type !== "COMPETITION") notFound();

  const now = new Date();
  const isUpcoming = now < activity.startTime;
  const isOngoing = now >= activity.startTime && now <= activity.endTime;
  const isJudging = now > activity.endTime;
  const themeRevealed = activity.themeRevealedAt ? now >= activity.themeRevealedAt : isOngoing || isJudging;

  const myTeam = activity.jamTeams.find(t =>
    t.members.some(m => m.userId === session?.user?.id)
  ) || null;

  const isJudge = activity.jamJudges.some(j => j.userId === session?.user?.id);
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  // 我收到的待处理邀请
  let myInvitations: any[] = [];
  if (session?.user?.id && !myTeam) {
    myInvitations = await prisma.jamTeamInvitation.findMany({
      where: { inviteeId: session.user.id, status: "PENDING" },
      include: { team: true, inviter: { select: { name: true } } },
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
        <span className="text-sm" style={{ color: "#999" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "#E38043" }}>🏆 Game Jam</span>
      </div>

      {/* 阶段状态 */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#25547A" }}>{activity.title}</h1>
            <p className="text-sm mt-1" style={{ color: "#777" }}>
              {isUpcoming && "报名组队中 · 比赛尚未开始"}
              {isOngoing && "比赛进行中"}
              {isJudging && "比赛已结束 · 评审阶段"}
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

      {/* 我的队伍 */}
      {myTeam ? (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: "#25547A" }}>我的队伍：{myTeam.name}</h2>
            <Link
              href={`/activities/${activityId}/game-jam/teams/${myTeam.id}`}
              className="text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: "#3388BB" }}
            >
              管理队伍
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {myTeam.members.map(m => (
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

          {/* 提交状态 */}
          {isOngoing && (
            <div className="mt-4 flex gap-2">
              {myTeam.members.some(m => m.role === "LEADER" && m.userId === session?.user?.id) && (
                <form action={async () => { "use server"; await disbandTeam(myTeam.id, activityId); }}>
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "#bbb" }}
                    onClick={(e) => { if (!confirm("确定解散队伍？此操作不可撤销。")) e.preventDefault(); }}>
                    解散队伍
                  </button>
                </form>
              )}
              <Link
                href={`/activities/${activityId}/game-jam/submit`}
                className="text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: "#25547A" }}
              >
                {activity.jamSubmissions.some(s => s.teamId === myTeam.id) ? "修改作品" : "提交作品"}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>👥 组队参赛</h2>

          {/* 待处理邀请 */}
          {myInvitations.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium" style={{ color: "#E38043" }}>你收到的队伍邀请：</p>
              {myInvitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#F0F6FA" }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#25547A" }}>{inv.team.name}</span>
                    <span className="text-xs ml-2" style={{ color: "#999" }}>来自 {inv.inviter.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <form action={async () => { "use server"; await handleInvitation(inv.id, activityId, "ACCEPTED"); }}>
                      <button type="submit" className="text-xs px-3 py-1 rounded text-white" style={{ background: "#3388BB" }}>
                        接受
                      </button>
                    </form>
                    <form action={async () => { "use server"; await handleInvitation(inv.id, activityId, "REJECTED"); }}>
                      <button type="submit" className="text-xs px-3 py-1 rounded" style={{ color: "#999", border: "1px solid #D0DEE8" }}>
                        拒绝
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isUpcoming && !myTeam && (
            <>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/activities/${activityId}/game-jam/teams`}
                  className="text-sm px-4 py-2 rounded-lg text-white"
                  style={{ background: "#3388BB" }}
                >
                  查看队伍
                </Link>
                <details className="group">
                  <summary className="text-sm px-4 py-2 rounded-lg border cursor-pointer list-none" style={{ borderColor: "#D0DEE8", color: "#555" }}>
                    创建队伍
                  </summary>
                  <form action={async (f: FormData) => { "use server"; await createTeam(activityId, f); }} className="mt-3 space-y-2">
                    <input name="name" placeholder="队伍名称（1-30字）" maxLength={30} required
                      className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D0DEE8" }} />
                    <button type="submit" className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: "#E38043" }}>
                      创建
                    </button>
                  </form>
                </details>
              </div>
            </>
          )}
        </div>
      )}

      {/* 评委列表 */}
      {activity.jamJudges.length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评委</h2>
          <div className="flex flex-wrap gap-2">
            {activity.jamJudges.map(j => (
              <span key={j.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full" style={{ background: "#F0F6FA", color: "#25547A" }}>
                <AvatarImg user={j.user} /> {j.user.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 提交列表（比赛结束后展示） */}
      {(isJudging || isAdmin) && activity.jamSubmissions.length > 0 && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎮 参赛作品（{activity.jamSubmissions.length}）</h2>
          <div className="grid gap-3">
            {activity.jamSubmissions.map(sub => (
              <Link
                key={sub.id}
                href={`/activities/${activityId}/game-jam/judging`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ border: "1px solid #D0DEE8" }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "#25547A" }}>{sub.title}</span>
                  <span className="text-xs ml-2" style={{ color: "#999" }}>— {sub.team.name}</span>
                </div>
                <div className="text-right">
                  {sub.scores.length > 0 ? (
                    <span className="text-sm font-semibold" style={{ color: "#E38043" }}>
                      {Math.round(sub.scores.reduce((a, b) => a + b.totalScore, 0) / sub.scores.length)} 分
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#999" }}>待评分</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 结果页入口 */}
      {activity.status === "ARCHIVED" && (
        <div className="mt-6 text-center">
          <Link
            href={`/activities/${activityId}/game-jam/results`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #E38043, #FFB347)" }}
          >
            🏆 查看比赛结果
          </Link>
        </div>
      )}
    </div>
  );
}
