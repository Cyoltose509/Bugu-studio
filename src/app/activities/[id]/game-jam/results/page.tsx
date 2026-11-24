import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import TrophyIcon from "@/components/icons/TrophyIcon";
import { resolveActivityId } from "@/lib/activities/resolve";
import {
  JAM_ADMIN_ENTRY_TOPIC,
  resolveJamEntryTeamName,
  sortJamSubmissionsForDisplay,
} from "@/lib/activities/jam-entries";

export default async function JamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";
  const activityId = await resolveActivityId((await params).id);
  if (!activityId) notFound();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
      jamSubmissions: {
        include: {
          project: { select: { id: true, slug: true, title: true } },
          team: { select: { id: true, name: true, topic: true, members: { select: { user: { select: { id: true, name: true, image: true } } } } } },
          scores: { include: { judge: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!activity) notFound();

  const withScores = activity.jamSubmissions.map(s => ({
    ...s,
    avgScore: s.scores.length > 0
      ? Math.round(s.scores.reduce((a, b) => a + b.totalScore, 0) / s.scores.length)
      : 0,
  }));

  // 若配置了奖杯或名次，则按奖杯置顶 + 排序栏名次 + 未排序栏随机；否则回退到均分排序
  const hasCustomRankOrTrophy = withScores.some(s => {
    const m = (s.metadata || {}) as Record<string, unknown>;
    return m.trophy != null || typeof m.sortOrder === "number";
  });

  const ranked = hasCustomRankOrTrophy
    ? sortJamSubmissionsForDisplay(withScores)
    : [...withScores]
        .sort((a, b) => b.avgScore - a.avgScore)
        .map((s, idx) => ({
          ...s,
          rank: idx + 1,
          parsedMeta: {
            coverImage: undefined,
            creators: [],
            trophy: idx === 0 ? ("GOLD" as const) : idx === 1 ? ("SILVER" as const) : idx === 2 ? ("BRONZE" as const) : null,
            sortOrder: idx,
            isAdminPlaceholder: false,
            links: [],
            tagIds: [],
            customTags: [],
          },
        }));

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const medalVariants: ("gold" | "silver" | "bronze")[] = ["gold", "silver", "bronze"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline text-brand-text-muted">
          ← 返回活动
        </Link>
      </div>

      {/* 头部 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-brand-navy">
          参赛作品（{activity.jamSubmissions.length}）
        </h1>
        <p className="text-sm text-brand-text-muted">比赛结果</p>
        {activity.theme && (
          <div className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#FFFDF7] border border-[#FFF3E0]">
            <span className="text-sm text-brand-orange">📋 题目：{activity.theme}</span>
          </div>
        )}
      </div>

      {ranked.length === 0 ? (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-8 text-center">
          <p className="text-lg text-brand-text-muted">暂无参赛作品</p>
        </div>
      ) : (
        <>
          {/* 前三名 / 获奖展示 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {ranked.slice(0, 3).map((sub, idx) => {
              const isPlaceholder = sub.team.topic === JAM_ADMIN_ENTRY_TOPIC || sub.parsedMeta.isAdminPlaceholder;
              const teamLabel =
                resolveJamEntryTeamName(sub) ||
                sub.parsedMeta.creators.map(c => c.name).join("、") ||
                "独立开发者";
              const trophyVariant = sub.parsedMeta.trophy
                ? (sub.parsedMeta.trophy.toLowerCase() as "gold" | "silver" | "bronze")
                : medalVariants[idx];
              return (
                <div key={sub.id} className={`bg-card rounded-xl border p-6 text-center relative overflow-hidden ${idx === 0 ? "border-[#FFD700]" : "border-brand-border-subtle"}`}>
                  {idx === 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,#FFD700,#FFA500)]" />
                  )}
                  <div className="mb-3 flex justify-center">
                    <TrophyIcon variant={trophyVariant} size={36} />
                  </div>
                  <h2 className="text-lg font-bold mb-1 text-brand-navy">{sub.title}</h2>
                  <p className="text-sm mb-3 text-brand-text-secondary">{teamLabel}</p>
                  {sub.scores.length > 0 && (
                    <div className="text-3xl font-bold text-brand-orange">
                      {sub.avgScore}
                      <span className="text-sm font-normal text-brand-text-muted"> 分</span>
                    </div>
                  )}
                  <div className="flex justify-center gap-1 mt-3">
                    {isPlaceholder
                      ? sub.parsedMeta.creators.map((c, cIdx) => (
                          <UserAvatar key={`${c.name}-${cIdx}`} src={c.avatar || null} name={c.name} size={32} />
                        ))
                      : sub.team.members.map(m => (
                          <UserAvatar key={m.user.id} src={m.user.image} name={m.user.name} size={32} />
                        ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 完整排名 */}
          <div className="bg-card rounded-xl border border-brand-border-subtle">
            <div className="p-4 border-b border-[#F0F0F0]">
              <h2 className="font-semibold text-brand-navy">完整排名</h2>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {ranked.map((sub, idx) => {
                const isPlaceholder = sub.team.topic === JAM_ADMIN_ENTRY_TOPIC || sub.parsedMeta.isAdminPlaceholder;
                const teamLabel =
                  resolveJamEntryTeamName(sub) ||
                  sub.parsedMeta.creators.map(c => c.name).join("、") ||
                  "独立开发者";
                const trophyVariant = sub.parsedMeta.trophy
                  ? (sub.parsedMeta.trophy.toLowerCase() as "gold" | "silver" | "bronze")
                  : null;
                return (
                <details key={sub.id} className="p-4">
                  <summary className="flex items-center gap-4 cursor-pointer list-none">
                    <div className={`font-bold shrink-0 w-10 text-center flex items-center justify-center ${idx < 3 ? `text-[${medalColors[idx]}] text-2xl` : "text-brand-text-muted text-base"}`}>
                      {trophyVariant ? (
                        <TrophyIcon variant={trophyVariant} size={22} />
                      ) : sub.rank !== null ? (
                        `#${sub.rank}`
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-brand-navy">{sub.title}</span>
                        <span className="text-xs text-brand-text-muted">— {teamLabel}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {isPlaceholder
                          ? sub.parsedMeta.creators.map((c, cIdx) => (
                              <span key={`${c.name}-${cIdx}`} className="text-xs text-brand-text-secondary">
                                <UserAvatar src={c.avatar || null} name={c.name} size={28} />
                              </span>
                            ))
                          : sub.team.members.map(m => (
                              <span key={m.user.id} className="text-xs text-brand-text-secondary">
                                <UserAvatar src={m.user.image} name={m.user.name} size={32} />
                              </span>
                            ))}
                      </div>
                    </div>
                    {sub.scores.length > 0 && (
                      <div className="shrink-0 text-right">
                        <div className="text-xl font-bold text-brand-orange">{sub.avgScore}</div>
                        <div className="text-xs text-brand-text-muted">{sub.scores.length} 位评委</div>
                      </div>
                    )}
                  </summary>

                  {/* 各评委详评 */}
                  {sub.scores.length > 0 && (
                    <div className="mt-3 ml-14 space-y-2">
                      {sub.scores.map(sc => {
                        const c = (sc.criteria || {}) as Record<string, number>;
                        return (
                          <div key={sc.id} className="text-xs p-2 rounded flex items-start gap-3 bg-[#F8FAFB]">
                            <span className="font-medium shrink-0 text-brand-text-body">{sc.judge.name}</span>
                            <div className="flex gap-3 text-[11px]">
                              <span>🎨 {(c.art ?? c.creativity ?? "-")}</span>
                              <span>📖 {(c.story ?? c.execution ?? "-")}</span>
                              <span>🎮 {(c.gameplay ?? c.theme ?? "-")}</span>
                            </div>
                            <span className="font-bold shrink-0 text-brand-orange">{sc.totalScore} 分</span>
                            {sc.comment && (
                              <span className="italic flex-1 text-brand-text-muted">"{sc.comment}"</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </details>
                );
              })}
            </div>
          </div>

          {/* 评委列表 */}
          {activity.jamJudges.length > 0 && (activity.judgesPublic || isAdmin) && (
            <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-brand-navy">🎯 评审团</h2>
                {!activity.judgesPublic && isAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-normal">
                    评委名单未向公众公开（仅管理可见）
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {activity.jamJudges.map(j => {
                  const name = j.user?.name || j.externalName || "评委";
                  const avatar = j.user?.image || null;
                  return (
                    <div key={j.id} className="flex items-center gap-2">
                      <UserAvatar src={avatar} name={name} size={32} />
                      <span className="text-sm text-brand-text-body">{name}</span>
                      {j.title && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-brand-surface-card text-brand-text-muted">
                          {j.title}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activity.jamJudges.length > 0 && !activity.judgesPublic && !isAdmin && (
            <div className="bg-card rounded-xl border border-brand-border-subtle p-5 mt-6 text-center text-sm text-brand-text-muted">
              🔒 本次活动评委阵容保密 / 未公开
            </div>
          )}
        </>
      )}
    </div>
  );
}
