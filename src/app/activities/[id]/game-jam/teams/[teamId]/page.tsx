import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTeam, applyToTeam, handleApplication } from "../../actions";
import { InviteMemberForm } from "./InviteMemberForm";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { EditTeamNameForm } from "./EditTeamNameForm";
import { ApplyToTeamForm } from "./ApplyToTeamForm";
import { ApplicationButtons } from "./ApplicationButtons";

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

  // 获取该活动所有队伍的成员 ID（用于邀请时排除已在队伍中的用户）
  const allTeamMemberIds = session?.user?.id ? (
    await prisma.jamTeamMember.findMany({
      where: {
        team: { activityId },
        userId: { not: session.user.id },
      },
      select: { userId: true },
    })
  ).map(m => m.userId) : [];

  const isLeader = team.members.some(m => m.userId === session?.user?.id && m.role === "LEADER");
  const isMember = team.members.some(m => m.userId === session?.user?.id);
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  // 检查是否已在该活动的任意队伍中
  const alreadyInAnotherTeam = !isMember && session?.user?.id ? await prisma.jamTeamMember.findFirst({
    where: {
      userId: session.user.id,
      team: { activityId, id: { not: teamId } },
    },
  }) : null;

  // 检查是否已申请
  const myApplication = await prisma.jamTeamApplication.findFirst({
    where: { teamId, userId: session?.user?.id, status: "PENDING" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
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
            <EditTeamNameForm teamId={teamId} activityId={activityId} defaultName={team.name} />
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
                <RemoveMemberButton teamId={teamId} activityId={activityId} memberId={m.id} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 入队申请（非成员、未在其他队伍中） */}
      {!isMember && !alreadyInAnotherTeam && session?.user && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>申请加入</h2>
          {myApplication ? (
            <p className="text-sm" style={{ color: "#E38043" }}>⏳ 申请已提交，等待队长审批</p>
          ) : (
            <ApplyToTeamForm teamId={teamId} activityId={activityId} />
          )}
        </div>
      )}

      {/* 已在其他队伍中，不能申请 */}
      {!isMember && alreadyInAnotherTeam && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <p className="text-sm" style={{ color: "#999" }}>🚫 你已加入其他队伍，请先退出当前队伍后再申请。</p>
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
                <ApplicationButtons teamId={teamId} activityId={activityId} applicationId={app.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 邀请队员（队长） */}
      {isLeader && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>邀请队员</h2>
          <InviteMemberForm
            teamId={teamId}
            activityId={activityId}
            existingMemberIds={allTeamMemberIds}
          />
        </div>
      )}
    </div>
  );
}
