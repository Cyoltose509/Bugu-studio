import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishResultsButton } from "./PublishResultsButton";
import { AddJudgeForm } from "./AddJudgeForm";
import { RemoveJudgeButton } from "./RemoveJudgeButton";
import { SubmitScoreForm } from "./SubmitScoreForm";
import { Suspense } from "react";

/* ── 工具函数 ── */

function AvatarImg({ user, size }: { user: { name?: string | null; image?: string | null }; size?: number }) {
  const s = size || 6;
  const initial = (user.name || "?")[0];
  if (user.image) {
    return <img src={user.image} alt="" className={`w-${s} h-${s} rounded-full object-cover shrink-0`} referrerPolicy="no-referrer" />;
  }
  return (
    <div className={`w-${s} h-${s} rounded-full flex items-center justify-center text-white shrink-0`}
      style={{ background: "#E38043", fontSize: s > 6 ? "0.8rem" : "0.65rem" }}>
      {initial}
    </div>
  );
}

/* ── 图片灯箱 (客户端) ── */
function LightboxLink({ src, children, className }: { src: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/* ── 自动确保所有非退役管理员加入评委团 ── */

async function ensureAdminJudges(activityId: string) {
  const adminUsers = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      NOT: { member: { isActive: false } },
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

  // 自动将非退役管理员加入评委团
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
                <RemoveJudgeButton activityId={activityId} judgeId={j.id} />
              </span>
            ))}
          </div>
          <AddJudgeForm activityId={activityId} existingJudgeIds={activity.jamJudges.map(j => j.userId)} />
        </div>
      )}

      {/* 参赛作品 */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold" style={{ color: "#25547A" }}>🎮 参赛作品（{rankedSubmissions.length}）</h2>
            {rankedSubmissions.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "#999" }}>
                点击作品即可展开详情并评分
              </p>
            )}
          </div>
          {isAdmin && activity.status !== "ARCHIVED" && (
            <PublishResultsButton activityId={activityId} />
          )}
        </div>

        {rankedSubmissions.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "#999" }}>暂无作品提交</p>
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
                  <summary className="list-none cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[#F8FAFB]"
                    style={{ borderColor: idx === 0 && sub.avgScore > 0 ? "#FFCC80" : "#D0DEE8" }}>
                    {/* 缩略图 */}
                    <div className="w-16 h-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center text-xs"
                      style={{ background: "#E6F0F8", color: "#999" }}>
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
                        <span className="font-semibold text-sm truncate" style={{ color: "#25547A" }}>{sub.title}</span>
                        {sub.projectId && (
                          <Link href={`/works/${sub.projectId}`} className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 hover:bg-[#E6F0F8]"
                            style={{ borderColor: "#88C232", color: "#88C232" }}>
                            📚 作品页
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "#999" }}>{sub.team.name}</span>
                        <span className="text-[10px]" style={{ color: "#ccc" }}>·</span>
                        <span className="text-xs" style={{ color: "#999" }}>
                          {sub.team.members.map(m => m.user.name).join("、")}
                        </span>
                      </div>
                    </div>

                    {/* 排名&均分 */}
                    {sub.avgScore > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold" style={{ color: idx === 0 ? "#E38043" : "#3388BB" }}>{sub.avgScore}</div>
                        <div className="text-[10px]" style={{ color: "#999" }}>
                          #{idx + 1} · {sub.scores.length}评
                        </div>
                      </div>
                    )}

                    {/* 打分状态指示 */}
                    <div className="text-xs shrink-0 text-right" style={{ color: myScore ? "#2E7D32" : "#999" }}>
                      {myScore ? "✅ 已评分" : "📝 待评分"}
                    </div>

                    {/* 展开指示 */}
                    <span className="text-sm shrink-0" style={{ color: "#ccc" }}>▸</span>
                  </summary>

                  {/* ---- 展开详情 ---- */}
                  <div className="mx-1 mt-1 rounded-b-xl border border-t-0 p-5" style={{ borderColor: "#D0DEE8", background: "#FAFBFC" }}>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* 左侧：作品信息 */}
                      <div className="lg:col-span-3 space-y-5">
                        {/* 封面图 + 截图画廊 */}
                        {(coverImage || imageFiles.length > 0) && (
                          <div className="space-y-3">
                            {/* 封面大图 */}
                            {coverImage && (
                              <LightboxLink src={coverImage}>
                                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#D0DEE8" }}>
                                  <img src={coverImage} alt={sub.title} className="w-full object-cover max-h-72" referrerPolicy="no-referrer" style={{ objectFit: "contain", background: "#F0F4F8" }} />
                                </div>
                              </LightboxLink>
                            )}
                            {/* 截图网格 */}
                            {imageFiles.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>📸 截图（{imageFiles.length}）</p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {imageFiles.map((url: string, i: number) => (
                                    <LightboxLink key={i} src={url}>
                                      <div className="aspect-video rounded-lg overflow-hidden border hover:ring-2 transition-all"
                                        style={{ borderColor: "#D0DEE8" }}
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
                            <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>📝 作品简介</h3>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>{sub.description}</p>
                          </div>
                        )}

                        {/* 外部链接 */}
                        {links.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>🔗 相关链接</h3>
                            <div className="flex flex-wrap gap-2">
                              {links.map((l, i) => (
                                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:shadow-sm"
                                  style={{ background: "#F0F6FA", color: "#3388BB" }}>
                                  {l.label} <span style={{ color: "#999" }}>↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 其他文件（非图片） */}
                        {otherFiles.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>📎 附件</h3>
                            <div className="flex flex-wrap gap-2">
                              {otherFiles.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors hover:bg-[#D0DEE8]"
                                  style={{ background: "#E6F0F8", color: "#555" }}>
                                  📎 文件 {i + 1} <span style={{ color: "#999" }}>↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 右侧：队伍 + 创作者 */}
                      <div className="lg:col-span-2 space-y-4">
                        {/* 队伍信息 */}
                        <div className="rounded-xl p-4" style={{ background: "#F0F5FA" }}>
                          <h3 className="text-sm font-semibold mb-3" style={{ color: "#25547A" }}>👥 参赛队伍</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium" style={{ color: "#333" }}>{sub.team.name}</span>
                            {sub.team.members.find(m => m.role === "LEADER") && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#FFF3E0", color: "#E38043" }}>
                                队长
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {sub.team.members.map(m => (
                              <span key={m.user.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                                style={{ background: "#fff", color: "#555" }}>
                                <AvatarImg user={m.user} />
                                {m.user.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 制作者（metadata.creators） */}
                        {creators.length > 0 && (
                          <div className="rounded-xl p-4" style={{ background: "#F0F5FA" }}>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>🎬 制作人员</h3>
                            <div className="space-y-1.5">
                              {creators.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span style={{ color: "#555" }}>{c.name}</span>
                                  <span style={{ color: "#999" }}>{c.roles?.join("、") || "制作"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="my-5 border-t" style={{ borderColor: "#D0DEE8" }} />

                    {/* 已有评分 */}
                    {sub.scores.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <h3 className="text-sm font-semibold mb-2" style={{ color: "#25547A" }}>🏆 评委评分（{sub.scores.length}）</h3>
                        {sub.scores.map(sc => {
                          const c = (sc.criteria || {}) as Record<string, number>;
                          return (
                            <div key={sc.id} className="text-xs p-3 rounded flex flex-wrap items-center gap-x-4 gap-y-1"
                              style={{ background: "#fff", border: "1px solid #E6F0F8" }}>
                              <span className="font-medium" style={{ color: "#555" }}>{sc.judge.name}</span>
                              <div className="flex gap-3">
                                <span>🎨 {(c.art ?? c.creativity ?? "-")}</span>
                                <span>📖 {(c.story ?? c.execution ?? "-")}</span>
                                <span>🎮 {(c.gameplay ?? c.theme ?? "-")}</span>
                              </div>
                              <span className="font-bold" style={{ color: "#E38043" }}>{sc.totalScore} 分</span>
                              {sc.comment && (
                                <span className="w-full italic" style={{ color: "#999" }}>"{sc.comment}"</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 评分表单 */}
                    {canAccess && (
                      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E6F0F8" }}>
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
