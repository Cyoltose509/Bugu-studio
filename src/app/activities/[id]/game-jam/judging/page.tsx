import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishResultsButton } from "@/components/activities/judging/PublishResultsButton";
import { AddJudgeForm } from "@/components/activities/judging/AddJudgeForm";
import { RemoveJudgeButton } from "@/components/activities/judging/RemoveJudgeButton";
import { SubmitScoreForm } from "@/components/activities/judging/SubmitScoreForm";
import { JudgingSettingsForm } from "@/components/activities/judging/JudgingSettingsForm";
import UserAvatar from "@/components/ui/UserAvatar";
import { resolveActivityId } from "@/lib/activities/resolve";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import TrophyIcon from "@/components/icons/TrophyIcon";

/* ── 图片灯箱 (客户端) ── */
function LightboxLink({ src, children, className }: { src: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/* ── 页面主体 ── */

export default async function JamJudgingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lang = await getLang();
  const activityId = await resolveActivityId((await params).id);
  if (!activityId) notFound();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      jamJudges: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
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

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-brand-navy">{t(lang, "judging.judgesOnly")}</p>
        <Link href={`/activities/${activityId}`} className="text-sm mt-4 inline-block text-brand-blue hover:underline">
          ← {t(lang, "gamejam.backToActivity")}
        </Link>
      </div>
    );
  }

  const isOnlineJudging = activity.judgingMode === "ONLINE";
  const isExternalJudging = activity.judgingMode === "EXTERNAL";
  const isJudgingDisabled = activity.judgingMode === "DISABLED";

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
          ← {t(lang, "gamejam.backToActivity")}
        </Link>
      </div>

      {/* 评审管理 & 评委管理（管理员） */}
      {isAdmin && (
        <div className="space-y-4 mb-6">
          <JudgingSettingsForm
            activityId={activityId}
            initialMode={activity.judgingMode}
            initialPublic={activity.judgesPublic}
            initialExternalUrl={activity.externalJudgingUrl}
          />

          <div className="bg-card rounded-xl border border-brand-border-subtle p-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-brand-navy">{t(lang, "judging.judgeManagement")}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand-text-muted">
                  {activity.jamJudges.length} 人
                </span>
                {!activity.judgesPublic && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                    🔒 {t(lang, "judging.judgesConfidentialAdminBadge")}
                  </span>
                )}
              </div>
            </div>

            {activity.jamJudges.length === 0 ? (
              <p className="text-xs text-brand-text-muted py-2">暂无评委，可通过下方表单添加社内成员或外部评委。</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {activity.jamJudges.map(j => (
                  <span key={j.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-[#F0F6FA] dark:bg-white/5 border border-brand-border-subtle">
                    {j.user ? (
                      <UserAvatar src={j.user.image} name={j.user.name} size={24} />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-semibold">
                        外
                      </span>
                    )}
                    <span className="text-brand-navy font-medium">
                      {j.user?.name || j.externalName}
                    </span>
                    {j.title && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-brand-surface text-brand-text-muted">
                        {j.title}
                      </span>
                    )}
                    <RemoveJudgeButton activityId={activityId} judgeId={j.id} />
                  </span>
                ))}
              </div>
            )}

            <AddJudgeForm
              activityId={activityId}
              existingJudgeIds={activity.jamJudges.map(j => j.userId).filter(Boolean) as string[]}
              canJoinSelf={session?.user?.id ? !activity.jamJudges.some(j => j.userId === session.user.id) : false}
            />
          </div>
        </div>
      )}

      {/* 评审模式非线上打分时的提示 */}
      {isExternalJudging && (
        <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-500/10 dark:border-blue-500/20 text-sm">
          <div className="flex items-center gap-2 font-medium text-brand-blue mb-1">
            <span>🌐</span>
            <span>{t(lang, "judging.modeExternal")}</span>
          </div>
          <p className="text-xs text-brand-text-secondary leading-relaxed">
            {t(lang, "judging.modeExternalNotice")}
          </p>
          {activity.externalJudgingUrl && (
            <div className="mt-2 pt-2 border-t border-blue-200/60 flex items-center gap-2">
              <span className="text-xs text-brand-text-muted">说明 / 链接：</span>
              {activity.externalJudgingUrl.startsWith("http") ? (
                <a
                  href={activity.externalJudgingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-brand-blue hover:underline break-all"
                >
                  {activity.externalJudgingUrl} ↗
                </a>
              ) : (
                <span className="text-xs text-brand-text-body font-medium">{activity.externalJudgingUrl}</span>
              )}
            </div>
          )}
        </div>
      )}

      {isJudgingDisabled && (
        <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50/70 dark:bg-white/5 dark:border-white/10 text-sm">
          <div className="flex items-center gap-2 font-medium text-brand-text-heading mb-1">
            <span>⏸️</span>
            <span>{t(lang, "judging.modeDisabled")}</span>
          </div>
          <p className="text-xs text-brand-text-muted leading-relaxed">
            {t(lang, "judging.modeDisabledNotice")}
          </p>
        </div>
      )}

      {/* 参赛作品 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-brand-navy">{t(lang, "activityDetail.jamEntries", { n: rankedSubmissions.length })}</h2>
            {rankedSubmissions.length > 0 && (
              <p className="text-xs mt-1 text-brand-text-muted">
                {isOnlineJudging ? t(lang, "judging.expandHint") : "点击作品可展开详情并查阅资料"}
              </p>
            )}
          </div>
          {isAdmin && activity.status !== "ARCHIVED" && (
            <PublishResultsButton activityId={activityId} />
          )}
        </div>

        {rankedSubmissions.length === 0 ? (
          <p className="text-sm py-8 text-center text-brand-text-muted">{t(lang, "judging.noSubmissions")}</p>
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
                  <summary className={`list-none cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[#F8FAFB] dark:hover:bg-white/5 ${idx === 0 && sub.avgScore > 0 && isOnlineJudging ? "border-[#FFCC80]" : "border-brand-border-subtle"}`}>
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
                            {t(lang, "judging.workPageShort")}
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

                    {/* 排名&均分（仅线上打分时展示） */}
                    {isOnlineJudging && sub.avgScore > 0 && (
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${idx === 0 ? "text-brand-orange" : "text-brand-blue"}`}>{sub.avgScore}</div>
                        <div className="text-[10px] text-brand-text-muted">
                          {t(lang, "judging.scoreCount", { rank: idx + 1, n: sub.scores.length })}
                        </div>
                      </div>
                    )}

                    {/* 打分状态指示（仅线上打分时展示） */}
                    {isOnlineJudging && (
                      <div className={`text-xs shrink-0 text-right ${myScore ? "text-[var(--ui-text-green)]" : "text-brand-text-muted"}`}>
                        {myScore ? t(lang, "judging.scored") : t(lang, "judging.pending")}
                      </div>
                    )}

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
                                <p className="text-xs font-medium mb-2 text-brand-text-secondary">{t(lang, "judging.screenshots", { n: imageFiles.length })}</p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {imageFiles.map((url: string, i: number) => (
                                    <LightboxLink key={i} src={url}>
                                      <div className="aspect-video rounded-lg overflow-hidden border border-brand-border-subtle hover:ring-2 transition-all">
                                        <img src={url} alt={t(lang, "form.screenshotAlt", { n: i + 1 })} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">{t(lang, "judging.workIntro")}</h3>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-brand-text-body">{sub.description}</p>
                          </div>
                        )}

                        {/* 外部链接 */}
                        {links.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">{t(lang, "judging.links")}</h3>
                            <div className="flex flex-wrap gap-2">
                              {links.map((l, i) => (
                                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:shadow-sm bg-[#F0F6FA] dark:bg-white/10 text-brand-blue">
                                  {l.label} <span className="text-brand-text-muted">↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 其他文件（非图片） */}
                        {otherFiles.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">{t(lang, "judging.attachments")}</h3>
                            <div className="flex flex-wrap gap-2">
                              {otherFiles.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:bg-[#D0DEE8] bg-brand-surface text-brand-text-body">
                                  {t(lang, "judging.fileN", { n: i + 1 })} <span className="text-brand-text-muted">↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 右侧：队伍 + 创作者 */}
                      <div className="lg:col-span-2 space-y-4">
                        {/* 队伍信息 */}
                        <div className="rounded-xl p-4 bg-[#F0F5FA] dark:bg-white/5">
                          <h3 className="text-sm font-semibold mb-3 text-brand-navy">{t(lang, "judging.team")}</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-brand-text-heading">{sub.team.name}</span>
                            {sub.team.members.find(m => m.role === "LEADER") && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF3E0] dark:bg-brand-orange/20 text-brand-orange">
                                {t(lang, "activityDetail.leader")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {sub.team.members.map(m => (
                              <span key={m.user.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-card text-brand-text-body border border-brand-border-subtle">
                                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                                {m.user.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 制作者（metadata.creators） */}
                        {creators.length > 0 && (
                          <div className="rounded-xl p-4 bg-[#F0F5FA] dark:bg-white/5">
                            <h3 className="text-sm font-semibold mb-2 text-brand-navy">{t(lang, "judging.creators")}</h3>
                            <div className="space-y-1.5">
                              {creators.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-brand-text-body">{c.name}</span>
                                  <span className="text-brand-text-muted">{c.roles?.join(t(lang, "works.detail.rolesSep")) || t(lang, "form.role.production")}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 已有评分（仅线上评审且有打分时展示） */}
                    {isOnlineJudging && sub.scores.length > 0 && (
                      <>
                        <div className="my-5 border-t border-brand-border-subtle" />
                        <div className="space-y-2 mb-4">
                          <h3 className="text-sm font-semibold mb-2 text-brand-navy flex items-center">
                            <TrophyIcon size={14} className="mr-1.5 text-brand-orange" />
                            {t(lang, "judging.scores", { n: sub.scores.length })}
                          </h3>
                          {sub.scores.map(sc => {
                            const c = (sc.criteria || {}) as Record<string, number>;
                            return (
                              <div key={sc.id} className="text-xs p-3 rounded-lg flex flex-wrap items-center gap-x-4 gap-y-1 bg-card border border-brand-border-subtle">
                                <span className="font-medium text-brand-text-body">{sc.judge.name}</span>
                                <div className="flex gap-3">
                                  <span>🎨 {(c.art ?? c.creativity ?? "-")}</span>
                                  <span>📖 {(c.story ?? c.execution ?? "-")}</span>
                                  <span>🎮 {(c.gameplay ?? c.theme ?? "-")}</span>
                                </div>
                                <span className="font-bold text-brand-orange">{t(lang, "activityDetail.scorePoints", { n: sc.totalScore })}</span>
                                {sc.comment && (
                                  <span className="w-full italic text-brand-text-muted mt-1">"{sc.comment}"</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* 评分表单（仅线上评审时开放） */}
                    {isOnlineJudging && canAccess && (
                      <>
                        <div className="my-5 border-t border-brand-border-subtle" />
                        <div className="rounded-xl p-4 bg-card border border-brand-border-subtle">
                          <SubmitScoreForm
                            activityId={activityId}
                            submissionId={sub.id}
                            myScore={myScore}
                          />
                        </div>
                      </>
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
