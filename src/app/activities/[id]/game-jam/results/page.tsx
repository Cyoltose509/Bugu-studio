import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";

export default async function JamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const activityId = (await params).id;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
      jamSubmissions: {
        include: {
          team: { select: { id: true, name: true, members: { select: { user: { select: { id: true, name: true, image: true } } } } } },
          scores: { include: { judge: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!activity) notFound();

  // 计算排名
  const ranked = activity.jamSubmissions
    .map(s => ({
      ...s,
      avgScore: s.scores.length > 0
        ? Math.round(s.scores.reduce((a, b) => a + b.totalScore, 0) / s.scores.length)
        : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const medalLabels = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
      </div>

      {/* 头部 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#25547A" }}>
          🏆 {activity.title}
        </h1>
        <p className="text-sm" style={{ color: "#999" }}>比赛结果</p>
        {activity.theme && (
          <div className="inline-block mt-3 px-4 py-2 rounded-lg" style={{ background: "#FFFDF7", border: "1px solid #FFF3E0" }}>
            <span className="text-sm" style={{ color: "#E38043" }}>📋 题目：{activity.theme}</span>
          </div>
        )}
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: "#D0DEE8" }}>
          <p className="text-lg" style={{ color: "#999" }}>暂无参赛作品</p>
        </div>
      ) : (
        <>
          {/* 前三名 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {ranked.slice(0, 3).map((sub, idx) => (
              <div key={sub.id} className="bg-white rounded-xl border p-6 text-center relative overflow-hidden"
                style={{ borderColor: idx === 0 ? "#FFD700" : "#D0DEE8" }}>
                {idx === 0 && (
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #FFD700, #FFA500)" }} />
                )}
                <div className="text-4xl mb-3">{medalLabels[idx]}</div>
                <h2 className="text-lg font-bold mb-1" style={{ color: "#25547A" }}>{sub.title}</h2>
                <p className="text-sm mb-3" style={{ color: "#777" }}>{sub.team.name}</p>
                <div className="text-3xl font-bold" style={{ color: "#E38043" }}>
                  {sub.avgScore}
                  <span className="text-sm font-normal" style={{ color: "#999" }}> 分</span>
                </div>
                <div className="flex justify-center gap-1 mt-3">
                  {sub.team.members.map(m => (
                    <UserAvatar key={m.user.id} src={m.user.image} name={m.user.name} size={32} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 完整排名 */}
          <div className="bg-white rounded-xl border" style={{ borderColor: "#D0DEE8" }}>
            <div className="p-4" style={{ borderBottom: "1px solid #F0F0F0" }}>
              <h2 className="font-semibold" style={{ color: "#25547A" }}>完整排名</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
              {ranked.map((sub, idx) => (
                <details key={sub.id} className="p-4">
                  <summary className="flex items-center gap-4 cursor-pointer list-none">
                    <div className="text-2xl font-bold shrink-0 w-10 text-center" style={{
                      color: idx < 3 ? medalColors[idx] : "#999",
                      fontSize: idx < 3 ? "1.5rem" : "1rem",
                    }}>
                      {idx < 3 ? medalLabels[idx] : `#${idx + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "#25547A" }}>{sub.title}</span>
                        <span className="text-xs" style={{ color: "#999" }}>— {sub.team.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {sub.team.members.map(m => (
                          <span key={m.user.id} className="text-xs" style={{ color: "#777" }}>
                            <UserAvatar src={m.user.image} name={m.user.name} size={32} />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-bold" style={{ color: "#E38043" }}>{sub.avgScore}</div>
                      <div className="text-xs" style={{ color: "#999" }}>{sub.scores.length} 位评委</div>
                    </div>
                  </summary>

                  {/* 各评委详评 */}
                  {sub.scores.length > 0 && (
                    <div className="mt-3 ml-14 space-y-2">
                      {sub.scores.map(sc => {
                        const c = (sc.criteria || {}) as Record<string, number>;
                        return (
                          <div key={sc.id} className="text-xs p-2 rounded flex items-start gap-3" style={{ background: "#F8FAFB" }}>
                            <span className="font-medium shrink-0" style={{ color: "#555" }}>{sc.judge.name}</span>
                            <div className="flex gap-3 text-[11px]">
                              <span>🎨 {(c.art ?? c.creativity ?? "-")}</span>
                              <span>📖 {(c.story ?? c.execution ?? "-")}</span>
                              <span>🎮 {(c.gameplay ?? c.theme ?? "-")}</span>
                            </div>
                            <span className="font-bold shrink-0" style={{ color: "#E38043" }}>{sc.totalScore} 分</span>
                            {sc.comment && (
                              <span className="italic flex-1" style={{ color: "#999" }}>"{sc.comment}"</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </div>

          {/* 评委列表 */}
          {activity.jamJudges.length > 0 && (
            <div className="bg-white rounded-xl border p-6 mt-6" style={{ borderColor: "#D0DEE8" }}>
              <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评审团</h2>
              <div className="flex flex-wrap gap-3">
                {activity.jamJudges.map(j => (
                  <div key={j.id} className="flex items-center gap-2">
                    <UserAvatar src={j.user.image} name={j.user.name} size={32} />
                    <span className="text-sm" style={{ color: "#555" }}>{j.user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
