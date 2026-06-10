import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTeam, applyToTeam, handleApplication, inviteMember, removeMember } from "../../actions";

function AvatarImg({ user }: { user: { name?: string | null; image?: string | null } }) {
  const initial = (user.name || "?")[0];
  if (user.image) {
    return <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#E38043" }}>
      {initial}
    </div>
  );
}

export default async function JamTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const session = await auth();
  const { id: activityId, teamId } = await params;

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId, activityId },
    include: {
      leader: { select: { id: true, name: true, image: true } },
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      },
      applications: {
        where: { status: "PENDING" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  if (!team) notFound();

  const isLeader = team.members.some(m => m.userId === session?.user?.id && m.role === "LEADER");
  const isMember = team.members.some(m => m.userId === session?.user?.id);
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  // 检查是否已申请
  const myApplication = await prisma.jamTeamApplication.findFirst({
    where: { teamId, userId: session?.user?.id, status: "PENDING" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}/game-jam`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回 Game Jam
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
        {/* 队名 & 队长 */}
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#25547A" }}>{team.name}</h1>
            <p className="text-sm mt-1" style={{ color: "#999" }}>
              👑 队长：{team.leader.name} · {team.members.length} 人
            </p>
          </div>
        </div>

        {/* 编辑队名（队长） */}
        {isLeader && (
          <details className="mb-6" style={{ display: "block" }}>
            <summary className="text-xs cursor-pointer list-none" style={{ color: "#999" }}>✏️ 编辑队伍名称</summary>
            <form action={async (f: FormData) => { "use server"; await updateTeam(teamId, activityId, f); }} className="mt-2 flex gap-2">
              <input name="name" defaultValue={team.name} maxLength={30} required
                className="flex-1 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
              <button type="submit" className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#3388BB" }}>
                保存
              </button>
            </form>
          </details>
        )}

        {/* 成员列表 */}
        <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>队伍成员</h2>
        <div className="space-y-3">
          {team.members.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#F8FAFB" }}>
              <div className="flex items-center gap-3">
                <AvatarImg user={m.user} />
                <div>
                  <span className="text-sm font-medium" style={{ color: "#333" }}>{m.user.name}</span>
                  <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full" style={{ background: m.role === "LEADER" ? "#FFF3E0" : "#F0F6FA", color: m.role === "LEADER" ? "#E38043" : "#999" }}>
                    {m.role === "LEADER" ? "队长" : "队员"}
                  </span>
                </div>
              </div>
              {isLeader && m.role !== "LEADER" && (
                <form action={async () => { "use server"; await removeMember(teamId, activityId, m.id); }}>
                  <button type="submit" className="text-xs px-2 py-1 rounded" style={{ color: "#bbb" }}
                    onClick={(e) => { if (!confirm("确定移除该成员？")) e.preventDefault(); }}>
                    移除
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 入队申请（非成员） */}
      {!isMember && session?.user && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>申请加入</h2>
          {myApplication ? (
            <p className="text-sm" style={{ color: "#E38043" }}>⏳ 申请已提交，等待队长审批</p>
          ) : (
            <form action={async (f: FormData) => { "use server"; await applyToTeam(teamId, activityId, f); }} className="space-y-3">
              <textarea name="message" rows={2} placeholder="留言（可选，如介绍你的技能）"
                className="w-full rounded-lg border px-3 py-2 text-sm resize-y" style={{ borderColor: "#D0DEE8" }} />
              <button type="submit" className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: "#E38043" }}>
                提交申请
              </button>
            </form>
          )}
        </div>
      )}

      {/* 入队申请管理（队长） */}
      {isLeader && team.applications.length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>入队申请（{team.applications.length}）</h2>
          <div className="space-y-3">
            {team.applications.map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#F8FAFB" }}>
                <div className="flex items-center gap-3">
                  <AvatarImg user={app.user} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#333" }}>{app.user.name}</span>
                    {app.message && <p className="text-xs mt-0.5" style={{ color: "#999" }}>{app.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={async () => { "use server"; await handleApplication(teamId, activityId, app.id, "APPROVED"); }}>
                    <button type="submit" className="text-xs px-3 py-1 rounded text-white" style={{ background: "#3388BB" }}>
                      通过
                    </button>
                  </form>
                  <form action={async () => { "use server"; await handleApplication(teamId, activityId, app.id, "REJECTED"); }}>
                    <button type="submit" className="text-xs px-3 py-1 rounded" style={{ color: "#999", border: "1px solid #D0DEE8" }}>
                      拒绝
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 邀请队员（队长） */}
      {isLeader && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>邀请队员</h2>
          <form action={async (f: FormData) => { "use server"; await inviteMember(teamId, activityId, f); }} className="flex gap-2">
            <input name="invitee" placeholder="输入对方昵称" required
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
            <button type="submit" className="text-sm px-4 py-1.5 rounded-lg text-white" style={{ background: "#3388BB" }}>
              发送邀请
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
