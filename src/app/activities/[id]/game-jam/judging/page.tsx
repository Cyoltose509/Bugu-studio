import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishResultsButton } from "@/components/activities/judging/PublishResultsButton";
import { AddJudgeForm } from "@/components/activities/judging/AddJudgeForm";
import { RemoveJudgeButton } from "@/components/activities/judging/RemoveJudgeButton";
import { SubmitScoreForm } from "@/components/activities/judging/SubmitScoreForm";
import { Suspense } from "react";
import UserAvatar from "@/components/ui/UserAvatar";

/* ── 图片灯箱 (客户端) ── */
function LightboxLink({ src, children, className }: { src: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/* ── 自动确保所有非毕业管理员加入评委团 ── */

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

/* ── 页面主体 ── */

export default async function JamJudgingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const activityId = (await params).id;

  // 自动将非毕业管理员加入评委团
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
      jamSubmissions: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              members: {
                select: { user: { select: { id: true, name: true, image: true } }, role: true },
              },
            },
          },
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
        <Link href={`/activities/${activityId}`} className="text-sm hover:underline text-brand-text-muted">
          ← 返回活动
        </Link>
      </div>

      {/* 评委管理（管理员） */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mb-6">
          <h2 className="font-semibold mb-3 text-brand-navy">🎯 评委管理</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {activity.jamJudges.map(j => (
              <span key={j.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-[#F0F6FA]">
                <UserAvatar src={j.user.image} name={j.user.name} size={24} />
                <span className="text-brand-navy">{j.user.name}</span>
                <RemoveJudgeButton activityId={activityId} judgeId={j.id} />
              </span>
            ))}
          </div>
          <AddJudgeForm activityId={activityId} existingJudgeIds={activity.jamJudges.map(j => j.userId)} />
        </div>
      )}

      {/* 参赛作品 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-brand-navy">🎮 参赛作品（{rankedSubmissions.length}）</h2>
            {rankedSubmissions.length > 0 && (
              <p className="text-xs mt-1 text-brand-text-muted">
                点击作品即可展开详情并评分
              </p>
            )}
          </div>
          {isAdmin && activity.status !== "ARCHIVED" && (
            <PublishResultsButton activityId={activityId} />
          )}
        </div>

        {rankedSubmissions.length === 0 ? (
          <p className="text-sm py-8 text-center text-brand-text-muted">暂无作品提交</p>
        ) : (
          <div className="space-y-3">
            {rankedSubmissions.map((sub, idx) => {
              const myScore = sub.scores.find(s => s.judgeId === session?.user?.id);
              const meta = (sub.metadata || {}) as Record<string, any>;
              const coverImage = meta.coverImage as string | undefined;
              const creators = (meta.creators || []) as { name: string; roles: string[] }[];
              const links = (meta.links || []) as { label: string; url: string }[];
              // 筛选出图片文件
              const imageFiles = sub.files.filter((f: string) =>
                /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(f)
              );
              const otherFiles = sub.files.filter((f: string) =>
                !/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(f)
              );

              return (
                <details key={sub.id} className="group">
                    {/* ---- 摘要行（收起时显示） ---- */}
                  <summary className={`list-none cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[#F8FAFB] ${idx === 0 && sub.avgScore > 0 ? "border-[#FFCC80]" : "border-brand-border-subtle"}`}>
                    {/* 缩略图 */}
                    <div className="w-16 h-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center text-xs bg-brand-surface text-brand-text-muted">
                      {coverImage ? (
                        <img src={coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : imageFiles.length > 0 ? (
                        <img src={imageFiles[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        "🎮"
                      )}
                    </div>

                    {/* 标题 + 队伍 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-brand-navy">{sub.title}</span>
                        {sub.projectId && (
                            <Link href={`/works/${sub.projectId}`} className="text-[10px] px-1.5 py-0.5 rounded-full border border-brand-green text-brand-green shrink-0 hover:bg-[#E6F0F8]">
                            📚 作品页
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-brand-text-muted">{sub.team.name}</span>
                        <span className="text-[10px] text-[#ccc]">·</span>
                        <span className="text-xs text-brand-text-muted">
                          {sub.team.members.map(m => m.user.name).join("、")}
                        </span>
                      </div>
                    </div>

                    {/* 排名&均分 */}
                        {sub.avgScore > 0 && (
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${idx === 0 ? "text-brand-orange" : "text-brand-blue"}`}>{sub.avgScore}</div>
                        <div className="text-[10px] text-brand-text-muted">
                          #{idx + 1} · {sub.scores.length}评
                        </div>
                      </div>
                    )}

                    {/* 打分状态指示 */}
                    <div className={`text-xs shrink-0 text-right ${myScore ? "text-[var(--ui-text-green)]" : "text-brand-text-muted"}`}>
                      {myScore ? "✅ 已评分" : "📝 待评分"}
                    </div>

                    {/* 展开指示 */}
                    <span className="text-sm shrink-0 text-[#ccc]">▸</span>
                  </summary>

                  {/* ---- 展开详情 ---- */}
                  <div className="mx-1 mt-1 rounded-b-xl border border-t-0 border-brand-border-subtle p-5 bg-muted">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* 左侧：作品信息 */}
                      <div className="lg:col-span-3 space-y-5">
                        {/* 封面图 + 截图画廊 */}
                        {(coverImage || imageFiles.length > 0) && (
                          <div className="space-y-3">
                            {/* 封面大图 */}
                            {coverImage && (
                              <LightboxLink src={coverImage}>
                                <div className="rounded-xl overflow-hidden border border-brand-border-subtle">
                                  <img src={coverImage} alt={sub.title} className="w-full object-contain max-h-72 bg-[#F0F4F8]" referrerPolicy="no-referrer" />
                                </div>
                              </LightboxLink>
                            )}
                            {/* 截图网格 */}
                            {imageFiles.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-2 text-brand-text-secondary">📸 截图（{imageFiles.length}）</p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {imageFiles.map((url: string, i: number) => (
                                    <LightboxLink key={i} src={url}>
                                      <div className="aspect-video rounded-lg overflow-hidden border border-brand-border-subtle hover:ring-2 transition-all"
                                      >
                                        <img src={url} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                    </LightboxLink>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 描述 */}
                        {sub.description && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">📝 作品简介</h3>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-brand-text-body">{sub.description}</p>
                          </div>
                        )}

                        {/* 外部链接 */}
                        {links.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">🔗 相关链接</h3>
                            <div className="flex flex-wrap gap-2">
                              {links.map((l, i) => (
                                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:shadow-sm bg-[#F0F6FA] text-brand-blue">
                                  {l.label} <span className="text-brand-text-muted">↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 其他文件（非图片） */}
                        {otherFiles.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">📎 附件</h3>
                            <div className="flex flex-wrap gap-2">
                              {otherFiles.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:bg-[#D0DEE8] bg-brand-surface text-brand-text-body">
                                  📎 文件 {i + 1} <span className="text-brand-text-muted">↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 右侧：队伍 + 创作者 */}
                      <div className="lg:col-span-2 space-y-4">
                        {/* 队伍信息 */}
                        <div className="rounded-xl p-4 bg-[#F0F5FA]">
                          <h3 className="text-sm font-semibold mb-3 text-brand-navy">👥 参赛队伍</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-brand-text-heading">{sub.team.name}</span>
                            {sub.team.members.find(m => m.role === "LEADER") && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF3E0] text-brand-orange">
                                队长
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {sub.team.members.map(m => (
                              <span key={m.user.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-card text-brand-text-body">
                                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                                {m.user.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 制作者（metadata.creators） */}
                        {creators.length > 0 && (
                          <div className="rounded-xl p-4 bg-[#F0F5FA]">
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">🎬 制作人员</h3>
                            <div className="space-y-1.5">
                              {creators.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-brand-text-body">{c.name}</span>
                                  <span className="text-brand-text-muted">{c.roles?.join("、") || "制作"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="my-5 border-t border-brand-border-subtle" />

                    {/* 已有评分 */}
                    {sub.scores.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <h3 className="text-sm font-semibold mb-2 text-brand-navy">🏆 评委评分（{sub.scores.length}）</h3>
                        {sub.scores.map(sc => {
                          const c = (sc.criteria || {}) as Record<string, number>;
                          return (
                            <div key={sc.id} className="text-xs p-3 rounded flex flex-wrap items-center gap-x-4 gap-y-1 bg-card border border-[#E6F0F8]">
                              <span className="font-medium text-brand-text-body">{sc.judge.name}</span>
                              <div className="flex gap-3">
                                <span>🎨 {(c.art ?? c.creativity ?? "-")}</span>
                                <span>📖 {(c.story ?? c.execution ?? "-")}</span>
                                <span>🎮 {(c.gameplay ?? c.theme ?? "-")}</span>
                              </div>
                              <span className="font-bold text-brand-orange">{sc.totalScore} 分</span>
                              {sc.comment && (
                                <span className="w-full italic text-brand-text-muted">"{sc.comment}"</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 评分表单 */}
                    {canAccess && (
                      <div className="rounded-xl p-4 bg-card border border-[#E6F0F8]">
                        <SubmitScoreForm
                          activityId={activityId}
                          submissionId={sub.id}
                          myScore={myScore}
                        />
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
