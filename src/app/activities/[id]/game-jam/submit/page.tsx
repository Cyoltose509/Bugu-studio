import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JamSubmitForm } from "@/components/activities/submit/JamSubmitForm";
import DeleteSubmissionButton from "@/components/activities/submit/DeleteSubmissionButton";
import SubmitToWorksButton from "@/components/activities/submit/SubmitToWorksButton";
import { resolveActivityId } from "@/lib/activities/resolve";

export default async function JamSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const activityId = await resolveActivityId((await params).id);
  if (!activityId) notFound();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity || activity.type !== "COMPETITION") notFound();

  // 找用户的队伍
  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: { include: { members: { include: { user: { select: { id: true, name: true } } } }, submission: { select: { id: true, title: true, projectId: true } } } } },
  });
  if (!membership) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline text-brand-text-muted">
          ← 返回活动
        </Link>
        <div className="bg-card rounded-xl border p-8 mt-4 text-center border-brand-border-subtle">
          <p className="text-lg mb-2 text-brand-navy">你还没有加入队伍</p>
          <p className="text-sm mb-4 text-brand-text-muted">请先创建或加入一个队伍</p>
          <Link href={`/activities/${activityId}/game-jam/teams`} className="text-sm px-4 py-2 rounded-lg text-white bg-brand-blue">
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
  const isLeader = membership.role === "LEADER";
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  const sub = existing || membership.team.submission;
  const hasSubmittedToWorks = !!sub?.projectId;

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
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline text-brand-text-muted">
          ← 返回活动
        </Link>
      </div>

      <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-brand-navy">
            {sub ? "修改作品" : "提交作品"}
          </h1>
          {sub && (isLeader || isAdmin) && (
            <DeleteSubmissionButton activityId={activityId} teamName={membership.team.name} />
          )}
        </div>
        <p className="text-sm mb-6 text-brand-text-muted">
          队伍：{membership.team.name} · {membership.team.members.length} 人 · {isOngoing ? "比赛进行中" : "比赛尚未开始"}
        </p>

        {/* 作品库状态 */}
        {sub && (
          <div className={`p-3 rounded-lg mb-4 text-sm flex items-center justify-between ${hasSubmittedToWorks ? "bg-[var(--ui-bg-green-light)] border border-[#C8E6C9]" : "bg-[#FFFDF7] border border-[#FFF3E0]"}`}>
            {hasSubmittedToWorks ? (
              <>
                <span className="text-green-800">✅ 已提交到作品库</span>
                <Link
                  href={`/works/${sub.projectId}`}
                  target="_blank"
                  className="text-xs hover:underline text-brand-blue"
                >
                  查看作品页 →
                </Link>
              </>
            ) : (
              <>
                <span className="text-[#E65100]">📌 尚未提交到作品库（仅参赛）</span>
                <SubmitToWorksButton
                  activityId={activityId}
                  submissionId={sub.id}
                  title={sub.title}
                />
              </>
            )}
          </div>
        )}

        {!isOngoing && (
          <div className="p-4 rounded-lg mb-4 bg-[#FFFDF7] border border-[#FFF3E0]">
            <p className="text-sm text-brand-orange">比赛尚未开始，开始后即可提交作品</p>
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
