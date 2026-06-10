import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JamSubmitForm } from "./JamSubmitForm";

export default async function JamSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const activityId = (await params).id;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity || activity.type !== "COMPETITION") notFound();

  // 找用户的队伍
  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } },
  });
  if (!membership) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
        <div className="bg-white rounded-xl border p-8 mt-4 text-center" style={{ borderColor: "#D0DEE8" }}>
          <p className="text-lg mb-2" style={{ color: "#25547A" }}>你还没有加入队伍</p>
          <p className="text-sm mb-4" style={{ color: "#999" }}>请先创建或加入一个队伍</p>
          <Link href={`/activities/${activityId}/game-jam/teams`} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: "#3388BB" }}>
            查看队伍
          </Link>
        </div>
      </div>
    );
  }

  const existing = await prisma.jamSubmission.findUnique({
    where: { teamId: membership.teamId },
  });

  const now = new Date();
  const isOngoing = now >= activity.startTime && now <= activity.endTime;

  // 获取所有标签（供表单选择）
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  // 队伍成员列表（自动填入制作人员）
  const teamMembers = membership.team.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    userName: m.user.name || "未知",
    role: m.role,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
        <h1 className="text-lg font-semibold mb-1" style={{ color: "#25547A" }}>
          {existing ? "修改作品" : "提交作品"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "#999" }}>
          队伍：{membership.team.name} · {membership.team.members.length} 人 · {isOngoing ? "比赛进行中" : "比赛尚未开始"}
        </p>

        {!isOngoing && (
          <div className="p-4 rounded-lg mb-4" style={{ background: "#FFFDF7", border: "1px solid #FFF3E0" }}>
            <p className="text-sm" style={{ color: "#E38043" }}>比赛尚未开始，开始后即可提交作品</p>
          </div>
        )}

        <JamSubmitForm
          activityId={activityId}
          isOngoing={isOngoing}
          existing={existing}
          teamMembers={teamMembers}
          tags={tags}
        />
      </div>
    </div>
  );
}
