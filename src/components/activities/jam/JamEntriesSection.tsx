"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CdnImage from "@/components/ui/CdnImage";
import PlusIcon from "@/components/ui/PlusIcon";
import TrophyIcon from "@/components/icons/TrophyIcon";
import FlagIcon from "@/components/icons/FlagIcon";
import ProjectCardMedia from "@/components/projects/ProjectCardMedia";
import JamEntryEditorModal from "./JamEntryEditorModal";
import JamProjectLinkModal from "./JamProjectLinkModal";
import {
  parseJamSubmissionMeta,
  normalizeJamScreenshots,
  splitJamEntriesByRank,
  sortJamSubmissionsForDisplay,
  resolveJamEntryTeamName,
  type JamCreatorItem,
  type JamTrophyType,
} from "@/lib/activities/jam-entries";
import {
  adminDeleteJamEntry,
  adminSetJamEntryTrophy,
  adminUpdateJamRankings,
} from "@/lib/actions/submissions";

export interface JamSubmissionViewItem {
  id: string;
  title: string;
  description?: string | null;
  files?: string[] | null;
  metadata?: unknown;
  projectId?: string | null;
  project?: {
    id: string;
    slug: string;
    title: string;
    subtitle?: string | null;
    coverImage?: string | null;
    status?: string;
  } | null;
  teamId?: string;
  team?: {
    id: string;
    name: string;
    topic?: string | null;
    members?: {
      id: string;
      userId: string;
      role?: string;
      user: { id: string; name: string | null; image: string | null };
    }[];
  } | null;
  scores?: { totalScore: number }[];
}

export type JamSubmissionItem = JamSubmissionViewItem;

const TROPHY_LABELS: Record<JamTrophyType, string> = {
  GOLD: "金奖",
  SILVER: "银奖",
  BRONZE: "铜奖",
};

function resolveEntryCreators(sub: JamSubmissionViewItem): JamCreatorItem[] {
  const meta = parseJamSubmissionMeta(sub.metadata);
  if (meta.creators.length > 0) return meta.creators;
  const teamMembers = sub.team?.members ?? [];
  return teamMembers.map((m) => ({
    name: m.user.name || "参赛成员",
    roles: m.role === "LEADER" ? ["队长"] : [],
    userId: m.userId,
    avatar: m.user.image,
  }));
}

function resolveCoverImage(sub: JamSubmissionViewItem): string | null {
  const meta = parseJamSubmissionMeta(sub.metadata);
  if (meta.coverImage) return meta.coverImage;
  if (sub.project?.coverImage) return sub.project.coverImage;
  const shots = normalizeJamScreenshots(sub.files);
  if (shots.length > 0) return shots[0];
  return null;
}

export default function JamEntriesSection({
  activityId,
  submissions,
  isAdmin,
}: {
  activityId: string;
  submissions: JamSubmissionViewItem[];
  isAdmin: boolean;
  isJudge?: boolean;
  judgingMode?: string | null;
}) {
  const router = useRouter();

  const [items, setItems] = useState<JamSubmissionViewItem[]>(submissions);
  useEffect(() => {
    setItems(submissions);
  }, [submissions]);

  // 客户端挂载后再触发未排序栏随机洗牌，避免 SSR Hydration 不一致
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  useEffect(() => {
    setRandomSeed(Math.random());
  }, []);

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    entry?: JamSubmissionViewItem | null;
  }>({ open: false, entry: null });

  const [linkModalSub, setLinkModalSub] = useState<JamSubmissionViewItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"ranked" | "unranked" | null>(null);

  const { ranked, unranked } = useMemo(() => splitJamEntriesByRank(items), [items]);

  const visitorOrdered = useMemo(() => {
    if (randomSeed === null) {
      return sortJamSubmissionsForDisplay(items, () => 0.999);
    }
    let state = Math.floor(randomSeed * 2147483647) || 1;
    const rng = () => {
      state = (state * 48271) % 2147483647;
      return (state - 1) / 2147483646;
    };
    return sortJamSubmissionsForDisplay(items, rng);
  }, [items, randomSeed]);

  const rankIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((r, idx) => {
      map.set(r.id, idx + 1);
    });
    return map;
  }, [ranked]);

  const persistZones = async (
    nextRanked: JamSubmissionViewItem[],
    nextUnranked: JamSubmissionViewItem[]
  ) => {
    const nextRankedIds = nextRanked.map((x) => x.id);
    const nextUnrankedIds = nextUnranked.map((x) => x.id);

    setItems((prev) =>
      prev.map((sub) => {
        const rIdx = nextRankedIds.indexOf(sub.id);
        const oldMeta =
          sub.metadata && typeof sub.metadata === "object"
            ? { ...(sub.metadata as Record<string, unknown>) }
            : {};
        if (rIdx !== -1) {
          oldMeta.sortOrder = rIdx;
        } else {
          oldMeta.sortOrder = null;
        }
        return { ...sub, metadata: oldMeta };
      })
    );

    await adminUpdateJamRankings(activityId, {
      rankedIds: nextRankedIds,
      unrankedIds: nextUnrankedIds,
    });
    router.refresh();
  };

  const handleToggleTrophy = async (sub: JamSubmissionViewItem, target: JamTrophyType) => {
    if (busyId) return;
    const current = parseJamSubmissionMeta(sub.metadata).trophy;
    const nextTrophy = current === target ? null : target;
    setBusyId(sub.id);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== sub.id) return item;
        const nextMeta =
          item.metadata && typeof item.metadata === "object"
            ? { ...(item.metadata as Record<string, unknown>), trophy: nextTrophy }
            : { trophy: nextTrophy };
        return { ...item, metadata: nextMeta };
      })
    );
    try {
      await adminSetJamEntryTrophy(activityId, sub.id, nextTrophy);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteEntry = async (sub: JamSubmissionViewItem) => {
    if (busyId) return;
    if (!window.confirm(`确定删除作品条目「${sub.title}」吗？`)) return;
    setBusyId(sub.id);
    try {
      const res = await adminDeleteJamEntry(activityId, sub.id);
      if (res && "error" in res && res.error) {
        alert(res.error);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== sub.id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const moveToRanked = (subId: string, insertIndex?: number) => {
    const item = items.find((x) => x.id === subId);
    if (!item) return;
    const nextRanked: JamSubmissionViewItem[] = ranked.filter((x) => x.id !== subId);
    const nextUnranked: JamSubmissionViewItem[] = unranked.filter((x) => x.id !== subId);
    const target =
      typeof insertIndex === "number"
        ? Math.max(0, Math.min(insertIndex, nextRanked.length))
        : nextRanked.length;
    nextRanked.splice(target, 0, item);
    void persistZones(nextRanked, nextUnranked);
  };

  const moveToUnranked = (subId: string) => {
    const item = items.find((x) => x.id === subId);
    if (!item) return;
    const nextRanked: JamSubmissionViewItem[] = ranked.filter((x) => x.id !== subId);
    const nextUnranked: JamSubmissionViewItem[] = unranked.filter((x) => x.id !== subId);
    nextUnranked.push(item);
    void persistZones(nextRanked, nextUnranked);
  };

  const renderEntryCard = (
    sub: JamSubmissionViewItem,
    options: { zone: "ranked" | "unranked" | "visitor"; index: number }
  ) => {
    const meta = parseJamSubmissionMeta(sub.metadata);
    const coverUrl = resolveCoverImage(sub);
    const screenshots = normalizeJamScreenshots(sub.files);
    const creators = resolveEntryCreators(sub);
    const teamName = resolveJamEntryTeamName(sub);
    const rank = rankIndexMap.get(sub.id) ?? null;
    const linkedSlug =
      sub.project && (!sub.project.status || sub.project.status === "PUBLISHED" || isAdmin)
        ? sub.project.slug
        : null;
    const isHovered = hoveredCardId === sub.id;

    // 复用与 ProjectCard 完全一致的头像叠放计算
    const n = creators.length;
    const avatarSize = 20;
    const maxW = 155;
    const normalOverlap = 6;
    const totalW = n === 0 ? 0 : avatarSize + (n - 1) * (avatarSize - normalOverlap);
    const overlap =
      n === 0
        ? normalOverlap
        : totalW > maxW
          ? Math.max(2, Math.min(avatarSize - 2, (n * avatarSize - maxW) / Math.max(1, n - 1)))
          : normalOverlap;

    const mediaBlock = (
      <div className="relative">
        <ProjectCardMedia
          coverImage={coverUrl}
          images={screenshots.map((url) => ({ url }))}
          title={sub.title}
          priority={options.index === 0}
          hovering={isHovered}
        />

        {/* 右上角奖杯角标（严格遵循 ProjectCard 规范：top-2 right-2 + TrophyIcon size=20 drop-shadow-md） */}
        <div
          className="absolute top-2 right-2 flex gap-0.5 text-lg z-10"
          data-awards={meta.trophy ? JSON.stringify([TROPHY_LABELS[meta.trophy]]) : undefined}
        >
          {meta.trophy && (
            <TrophyIcon
              variant={meta.trophy}
              size={20}
              title={TROPHY_LABELS[meta.trophy]}
              className="drop-shadow-md"
            />
          )}
        </div>

        {/* 左上角名次角标（严格遵循 ProjectCard 左上角胶囊规范：top-2 left-2 bg-black/50 text-white） */}
        {rank != null && (
          <div className="absolute top-2 left-2 z-10 leading-none">
            <span
              data-testid={`jam-rank-badge-${sub.id}`}
              className="inline-flex items-center justify-center text-[10px] sm:text-xs leading-4 bg-black/50 text-white px-1.5 sm:px-2 py-0.5 rounded"
            >
              #{rank}
            </span>
          </div>
        )}

        {/* 管理员悬停封面浮层操作（不破坏卡片主体比例，平时与 ProjectCard 100% 同构） */}
        {isAdmin && (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-x-1.5 bottom-1.5 z-20 flex flex-wrap items-center justify-between gap-1 rounded-lg bg-black/65 px-2 py-1 text-[11px] text-white backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          >
            <div className="flex items-center gap-1">
              {(["GOLD", "SILVER", "BRONZE"] as JamTrophyType[]).map((tType) => {
                const active = meta.trophy === tType;
                return (
                  <button
                    key={tType}
                    type="button"
                    disabled={busyId === sub.id}
                    aria-label={TROPHY_LABELS[tType]}
                    title={`设为${TROPHY_LABELS[tType]}`}
                    onClick={() => handleToggleTrophy(sub, tType)}
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors ${
                      active
                        ? "bg-white/25 font-semibold text-white"
                        : "text-white/75 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    <TrophyIcon variant={tType} size={12} />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              {options.zone === "ranked" ? (
                <button
                  type="button"
                  onClick={() => moveToUnranked(sub.id)}
                  className="rounded px-1.5 py-0.5 text-white/85 hover:bg-white/15 hover:text-white"
                >
                  移入未排序
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => moveToRanked(sub.id)}
                  className="rounded px-1.5 py-0.5 text-white/85 hover:bg-white/15 hover:text-white"
                >
                  + 加入排序栏
                </button>
              )}

              <button
                type="button"
                onClick={() => setLinkModalSub(sub)}
                className="rounded px-1.5 py-0.5 text-white/85 hover:bg-white/15 hover:text-white"
              >
                {sub.project ? "已关联作品库" : "关联作品库"}
              </button>

              <button
                type="button"
                onClick={() => setEditorState({ open: true, entry: sub })}
                className="rounded px-1.5 py-0.5 text-white/85 hover:bg-white/15 hover:text-white"
              >
                编辑
              </button>

              <button
                type="button"
                onClick={() => handleDeleteEntry(sub)}
                disabled={busyId === sub.id}
                className="rounded px-1.5 py-0.5 text-red-300 hover:bg-red-500/30 hover:text-white"
              >
                删除
              </button>
            </div>
          </div>
        )}
      </div>
    );

    const headingEl = (
      <h3 className="font-semibold leading-snug group-hover:text-[#3388BB] transition-colors flex items-baseline gap-1.5 min-w-0 text-[15px] sm:text-base text-brand-text-heading">
        <span className="truncate min-w-0">{sub.title}</span>
      </h3>
    );

    const bodyBlock = (
      <div className="flex flex-1 flex-col p-3 sm:p-4 min-h-0">
        {linkedSlug && isAdmin ? (
          <Link href={`/works/${linkedSlug}`} className="min-w-0 block">
            {headingEl}
          </Link>
        ) : (
          headingEl
        )}

        {/* 底部：左下角小红旗+队名 + 右下角开发人员叠放头像簇（严格对齐 ProjectCard） */}
        <div className="flex items-center gap-1.5 mt-auto pt-2.5 sm:pt-3">
          {teamName ? (
            <span
              className="inline-flex min-w-0 items-center gap-1 text-xs flex-shrink-0 text-brand-text-muted"
              title={teamName}
            >
              <FlagIcon size={12} />
              <span className="truncate">{teamName}</span>
            </span>
          ) : (
            <span className="text-xs flex-shrink-0 invisible" aria-hidden>
              0000
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {n > 0 && (
              <div
                className="flex items-center overflow-hidden"
                style={
                  {
                    "--avatar-max-w": `${maxW}px`,
                    maxWidth: "var(--avatar-max-w)",
                  } as React.CSSProperties
                }
              >
                {creators.map((c, i) => {
                  const roleTip = c.roles?.length ? `${c.name} · ${c.roles.join("/")}` : c.name;
                  return (
                    <span
                      key={`${c.memberId || c.userId || c.name}-${i}`}
                      className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] text-white border border-white overflow-hidden flex-shrink-0 ${
                        c.memberId
                          ? "bg-brand-orange"
                          : c.userId
                            ? "bg-brand-blue"
                            : "bg-gray-500"
                      }`}
                      style={
                        {
                          "--overlap": `${overlap}px`,
                          marginLeft: i === 0 ? "0" : "calc(-1 * var(--overlap))",
                        } as React.CSSProperties
                      }
                      title={roleTip}
                    >
                      {c.avatar ? (
                        <CdnImage
                          src={c.avatar}
                          alt={c.name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        c.name[0]
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );

    const commonCardClass = `group relative flex h-full flex-col bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md border-brand-border-subtle transition-shadow ${
      draggedId === sub.id ? "opacity-50" : ""
    } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`;

    return (
      <div
        key={sub.id}
        data-testid={`jam-entry-card-${sub.id}`}
        data-entry-id={sub.id}
        draggable={isAdmin}
        onMouseEnter={() => setHoveredCardId(sub.id)}
        onMouseLeave={() => setHoveredCardId((cur) => (cur === sub.id ? null : cur))}
        onDragStart={(e) => {
          if (!isAdmin) return;
          setDraggedId(sub.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", sub.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverZone(null);
        }}
        onDragOver={(e) => {
          if (!isAdmin || !draggedId || draggedId === sub.id) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!isAdmin || !draggedId || draggedId === sub.id) return;
          e.preventDefault();
          e.stopPropagation();
          if (options.zone === "ranked") {
            moveToRanked(draggedId, options.index);
          } else if (options.zone === "unranked") {
            moveToUnranked(draggedId);
          }
          setDraggedId(null);
          setDragOverZone(null);
        }}
        className="h-full"
      >
        {linkedSlug && !isAdmin ? (
          <Link
            href={`/works/${linkedSlug}`}
            className={`${commonCardClass} cursor-pointer`}
          >
            {mediaBlock}
            {bodyBlock}
          </Link>
        ) : (
          <div className={commonCardClass}>
            {mediaBlock}
            {bodyBlock}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
      {/* 标题栏与本站标准 "+" 按钮（对齐 AgendaManagePanel 规范） */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-brand-navy">参赛作品 ({items.length})</h3>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditorState({ open: true, entry: null })}
            aria-label="添加参赛作品条目"
            title="添加参赛作品条目"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white transition-colors hover:bg-brand-blue/90"
          >
            <PlusIcon size={18} />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border-subtle py-10 text-center text-sm text-brand-text-muted">
          暂无参赛作品条目
          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditorState({ open: true, entry: null })}
              className="ml-2 text-brand-blue hover:underline font-medium"
            >
              点击右上角「+」创建第一条作品
            </button>
          )}
        </div>
      ) : isAdmin ? (
        <div className="space-y-4">
          {/* 排序栏（自动标名次 #1, #2, #3...） */}
          <div
            data-testid="jam-ranked-zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone("ranked");
            }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId) {
                moveToRanked(draggedId);
              }
              setDraggedId(null);
              setDragOverZone(null);
            }}
            className={`rounded-xl transition-colors ${
              dragOverZone === "ranked" ? "ring-2 ring-brand-blue/40 bg-brand-blue/5 p-2" : ""
            }`}
          >
            {ranked.length === 0 ? (
              draggedId ? (
                <div className="rounded-xl border border-dashed border-brand-border-subtle py-4 text-center text-xs text-brand-text-muted">
                  拖入此处加入排序栏（自动标 #1, #2, #3...）
                </div>
              ) : null
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                {ranked.map((sub, idx) => renderEntryCard(sub, { zone: "ranked", index: idx }))}
              </div>
            )}
          </div>

          {/* 隐形分栏分隔线（仅在两栏均有卡片或拖拽时出现轻量虚线） */}
          {(ranked.length > 0 && unranked.length > 0) || draggedId ? (
            <div className="border-t border-dashed border-brand-border-subtle" />
          ) : null}

          {/* 未排序栏 */}
          <div
            data-testid="jam-unranked-zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone("unranked");
            }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId) {
                moveToUnranked(draggedId);
              }
              setDraggedId(null);
              setDragOverZone(null);
            }}
            className={`rounded-xl transition-colors ${
              dragOverZone === "unranked" ? "ring-2 ring-brand-orange/40 bg-brand-orange/5 p-2" : ""
            }`}
          >
            {unranked.length === 0 ? (
              draggedId ? (
                <div className="rounded-xl border border-dashed border-brand-border-subtle py-4 text-center text-xs text-brand-text-muted">
                  拖入此处移入未排序栏（随机顺序展示）
                </div>
              ) : null
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                {unranked.map((sub, idx) =>
                  renderEntryCard(sub, { zone: "unranked", index: idx })
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 普通访客视图：与本站作品橱窗完全同构的三列 ProjectCard 网格（获奖置顶 → 排序栏名次 → 未排序栏随机） */
        <div
          data-testid="jam-visitor-list"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
        >
          {visitorOrdered.map((sub, idx) => renderEntryCard(sub, { zone: "visitor", index: idx }))}
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      {editorState.open && (
        <JamEntryEditorModal
          activityId={activityId}
          initialData={
            editorState.entry
              ? {
                  submissionId: editorState.entry.id,
                  title: editorState.entry.title,
                  teamName: resolveJamEntryTeamName(editorState.entry) || undefined,
                  coverImage: resolveCoverImage(editorState.entry) || undefined,
                  screenshots: normalizeJamScreenshots(editorState.entry.files),
                  creators: resolveEntryCreators(editorState.entry),
                  trophy: parseJamSubmissionMeta(editorState.entry.metadata).trophy,
                  projectId: editorState.entry.projectId,
                  projectTitle: editorState.entry.project?.title ?? null,
                }
              : undefined
          }
          onClose={() => setEditorState({ open: false, entry: null })}
          onSaved={() => router.refresh()}
        />
      )}

      {/* 关联作品库游戏弹窗 */}
      {linkModalSub && (
        <JamProjectLinkModal
          activityId={activityId}
          submissionId={linkModalSub.id}
          submissionTitle={linkModalSub.title}
          currentProjectId={linkModalSub.projectId}
          currentProjectTitle={linkModalSub.project?.title ?? null}
          onClose={() => setLinkModalSub(null)}
          onUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}
