import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";

export default async function JamTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const activityId = (await params).id;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamTeams: {
        include: {
          leader: { select: { id: true, name: true, image: true } },
          members: { include: { user: { select: { id: true, name: true, image: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!activity) return <p className="text-center text-sm py-12" style={{ color: "#999" }}>活动不存在</p>;

  const myTeam = activity.jamTeams.find(t =>
    t.members.some(m => m.userId === session?.user?.id)
  ) || null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold" style={{ color: "#25547A" }}>👥 参赛队伍（{activity.jamTeams.length}）</h1>
        </div>

        {activity.jamTeams.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "#999" }}>暂无队伍</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activity.jamTeams.map(team => (
              <Link
                key={team.id}
                href={`/activities/${activityId}/game-jam/teams/${team.id}`}
                className="p-4 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ border: `2px solid ${myTeam?.id === team.id ? "#3388BB" : "#D0DEE8"}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm" style={{ color: "#25547A" }}>{team.name}</span>
                  {myTeam?.id === team.id && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "#3388BB", fontSize: "10px" }}>我的队伍</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#999" }}>
                    👑 {team.leader.name}
                  </span>
                  <span className="text-xs" style={{ color: "#999" }}>
                    · {team._count.members} 人
                  </span>
                </div>
                <div className="flex mt-2 gap-1.5">
                  {team.members.slice(0, 4).map(m => (
                    <UserAvatar key={m.id} src={m.user.image} name={m.user.name} size={24} />
                  ))}
                  {team._count.members > 4 && (
                    <span className="text-xs" style={{ color: "#999" }}>+{team._count.members - 4}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
