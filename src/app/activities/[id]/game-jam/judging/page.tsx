import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addJudge, removeJudge, submitScore } from "../actions";
import { PublishResultsButton } from "./PublishResultsButton";
import { AddJudgeForm } from "./AddJudgeForm";

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

export default async function JamJudgingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
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

  const isJudge = activity.jamJudges.some(j => j.userId === session?.user?.id);
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";
  const canAccess = isAdmin || isJudge;

  // 计算排名
  const rankedSubmissions = activity.jamSubmissions
    .map(s => ({
      ...s,
      avgScore: s.scores.length > 0
        ? Math.round(s.scores.reduce((a, b) => a + b.totalScore, 0) / s.scores.length)
        : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline" style={{ color: "#999" }}>
          ← 返回活动
        </Link>
      </div>

      {/* 评委管理（管理员） */}
      {isAdmin && (
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>🎯 评委管理</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {activity.jamJudges.map(j => (
              <span key={j.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full" style={{ background: "#F0F6FA" }}>
                <AvatarImg user={j.user} />
                <span style={{ color: "#25547A" }}>{j.user.name}</span>
                <form action={async () => { "use server"; await removeJudge(activityId, j.id); }}>
                  <button type="submit" className="text-xs" style={{ color: "#bbb" }}>✕</button>
                </form>
              </span>
            ))}
          </div>
          <AddJudgeForm activityId={activityId} existingJudgeIds={activity.jamJudges.map(j => j.userId)} />
        </div>
      )}

      {/* 参赛作品评分 */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: "#25547A" }}>🎮 参赛作品（{rankedSubmissions.length}）</h2>
          {isAdmin && activity.status !== "ARCHIVED" && (
            <PublishResultsButton activityId={activityId} />
          )}
        </div>

        {rankedSubmissions.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "#999" }}>暂无作品提交</p>
        ) : (
          <div className="space-y-4">
            {rankedSubmissions.map((sub, idx) => {
              const myScore = sub.scores.find(s => s.judgeId === session?.user?.id);
              return (
                <div key={sub.id} className="p-4 rounded-lg" style={{ border: "1px solid #D0DEE8" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "#25547A" }}>{sub.title}</span>
                        {rankedSubmissions.length > 1 && sub.avgScore > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: idx === 0 ? "#FFF3E0" : "#F0F6FA",
                            color: idx === 0 ? "#E38043" : "#999",
                          }}>
                            #{idx + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#999" }}>
                        队伍：{sub.team.name} · {sub.team.members.map(m => m.user.name).join("、")}
                      </p>
                      {sub.description && (
                        <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#777" }}>{sub.description}</p>
                      )}
                    </div>
                    {sub.avgScore > 0 && (
                      <span className="text-lg font-bold" style={{ color: "#E38043" }}>{sub.avgScore}</span>
                    )}
                  </div>

                  {/* 文件链接 */}
                  {sub.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {sub.files.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded underline" style={{ color: "#3388BB", background: "#F0F6FA" }}>
                          📎 文件 {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 已有评分 */}
                  {sub.scores.length > 0 && (
                    <div className="mb-3 space-y-1">
                      <p className="text-xs font-medium" style={{ color: "#555" }}>评委评分：</p>
                      {sub.scores.map(sc => (
                        <div key={sc.id} className="flex items-center gap-2 text-xs" style={{ color: "#777" }}>
                          <AvatarImg user={{ name: sc.judge.name, image: undefined }} />
                          <span>{sc.judge.name}</span>
                          <span className="font-semibold" style={{ color: "#E38043" }}>{sc.totalScore} 分</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 打分表单 */}
                  {canAccess && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer list-none" style={{ color: myScore ? "#3388BB" : "#E38043" }}>
                        {myScore ? "✏️ 修改评分" : "📝 打分"}
                      </summary>
                      <form action={async (f: FormData) => { "use server"; await submitScore(activityId, f); }} className="mt-3 space-y-3 p-3 rounded-lg" style={{ background: "#F8FAFB" }}>
                        <input type="hidden" name="submissionId" value={sub.id} />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "#777" }}>创意</label>
                            <input name="creativity" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).creativity : ""}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "#777" }}>执行</label>
                            <input name="execution" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).execution : ""}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "#777" }}>主题</label>
                            <input name="theme" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).theme : ""}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "#777" }}>整体</label>
                            <input name="overall" type="number" min={0} max={100} defaultValue={myScore ? (myScore.criteria as any).overall : ""}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: "#D0DEE8" }} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#777" }}>评语（可选）</label>
                          <textarea name="comment" rows={2} defaultValue={myScore?.comment || ""}
                            className="w-full rounded-lg border px-3 py-1.5 text-sm resize-y" style={{ borderColor: "#D0DEE8" }} />
                        </div>
                        <button type="submit" className="text-xs px-4 py-1.5 rounded-lg text-white" style={{ background: "#3388BB" }}>
                          提交评分
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
