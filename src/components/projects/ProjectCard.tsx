"use client";

import Link from "next/link";
import React, { useCallback, useMemo, useState } from "react";
import MiniLikeButton from "./MiniLikeButton";
import ProjectCardMedia, { type CardGalleryImage } from "./ProjectCardMedia";
import { toPlainCardText } from "@/lib/rich-content";
import { TagChip } from "@/components/tags/TagChip";
import { sortProjectTagsEngineFirst } from "@/lib/tags/engine-tags";

const TYPE_LABELS: Record<string, string> = {
  IN_DEVELOPMENT: "开发阶段",
  TRIAL_DEMO: "提供试玩",
  MINI_GAME: "小游戏",
  OFFICIAL_RELEASE: "正式上架",
};

export interface ProjectCardProject {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  type: string;
  developYear: number | null;
  status?: string;
  awards?: string[];
  aiUsages?: string[];
  /** 详情截图 — 悬停卡片时轮播 */
  images?: CardGalleryImage[];
  tags?: {
    tag: {
      slug: string;
      name: string;
      color?: string | null;
      group?: string | null;
      sortOrder?: number;
    };
  }[];
  _count?: { likes: number };
  liked?: boolean;
  members?: {
    id: string;
    externalName: string | null;
    member?: {
      displayName: string;
      avatar: string | null;
      user?: { image: string | null } | null;
    } | null;
    user?: { name: string | null; image: string | null } | null;
  }[];
}

export interface ProjectCardProps {
  project: ProjectCardProject;
  href?: string;
  showStatusBadge?: boolean;
  compact?: boolean;
  clicking?: boolean;
  onCardClick?: (id: string, slug: string) => void;
  idx?: number;
}

function ProjectCard({
  project: p,
  href,
  showStatusBadge = false,
  compact = false,
  clicking = false,
  onCardClick,
  idx = 0,
}: ProjectCardProps) {
  const link = href ?? `/works/${p.slug}`;
  const delay = `${Math.min(idx % 16, 15) * 50}ms`;
  const [hovering, setHovering] = useState(false);

  const n = p.members?.length ?? 0;
  const avatarSize = 20;
  const maxW = 155;
  const normalOverlap = 6;
  const overlap = useMemo(() => {
    if (n === 0) return normalOverlap;
    const totalW = avatarSize + (n - 1) * (avatarSize - normalOverlap);
    return totalW > maxW
      ? Math.max(2, Math.min(avatarSize - 2, (n * avatarSize - maxW) / Math.max(1, n - 1)))
      : normalOverlap;
  }, [n]);

  const useLink = !onCardClick;
  const commonClassName =
    "group relative flex h-full flex-col bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md border-brand-border-subtle";

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onCardClick) {
        e.preventDefault();
        if (!clicking) onCardClick(p.id, p.slug);
      }
    },
    [onCardClick, p.id, p.slug, clicking],
  );

  const excerpt = useMemo(() => toPlainCardText(p.description), [p.description]);

  const hoverHandlers = {
    onMouseEnter: () => setHovering(true),
    onMouseLeave: () => setHovering(false),
  };

  const cardContent = (
    <>
      {clicking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/40 rounded-xl">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/90 shadow-lg text-brand-navy">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-medium">加载中…</span>
          </div>
        </div>
      )}

      <div className="relative">
        <ProjectCardMedia
          coverImage={p.coverImage}
          images={p.images}
          title={p.title}
          priority={idx === 0}
          hovering={hovering}
        />

        <div
          className="absolute top-2 right-2 flex gap-0.5 text-lg z-10"
          data-ai={JSON.stringify(p.aiUsages)}
          data-awards={JSON.stringify(p.awards)}
        >
          {p.awards && p.awards.length > 0 && (
            <span title={p.awards.join("、")}>🏆</span>
          )}
          {p.aiUsages && p.aiUsages.length > 0 && (
            <span title="使用了 AI 技术">🤖</span>
          )}
        </div>

        {showStatusBadge && p.status && (
          <span
            className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm z-10 text-white ${
              p.status === "PUBLISHED" ? "bg-green-700/85" : "bg-orange-600/85"
            }`}
          >
            {p.status === "PUBLISHED"
              ? "已发布"
              : p.status === "PENDING"
                ? "待审核"
                : p.status}
          </span>
        )}

        <div className="absolute top-2 left-2 z-10">
          <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">
            {TYPE_LABELS[p.type] || p.type}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 min-h-0">
        <h3 className="font-semibold group-hover:text-[#3388BB] transition-colors flex items-baseline gap-1.5 min-w-0 text-brand-text-heading">
          <span className="truncate min-w-0">{p.title}</span>
          {p.subtitle && (
            <span className="text-xs font-normal truncate max-w-[45%] text-brand-text-muted">
              {p.subtitle}
            </span>
          )}
        </h3>

        {!compact && (
          <p
            className="text-sm mt-1 h-10 leading-5 line-clamp-2 text-brand-text-secondary"
            aria-hidden={!excerpt}
          >
            {excerpt || "\u00A0"}
          </p>
        )}

        <div className="mt-3 h-6 flex items-center gap-1.5 overflow-hidden">
          {sortProjectTagsEngineFirst(p.tags ?? [])
            .slice(0, 3)
            .map(({ tag }) => (
              <TagChip key={tag.slug} tag={tag} />
            ))}
        </div>

        <div className="flex items-center gap-1.5 mt-auto pt-3">
          {p.developYear ? (
            <span className="text-xs flex-shrink-0 text-brand-text-muted">
              {p.developYear}
            </span>
          ) : (
            <span className="text-xs flex-shrink-0 invisible" aria-hidden>
              0000
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MiniLikeButton
              projectId={p.id}
              initialCount={p._count?.likes ?? 0}
              initialLiked={p.liked ?? false}
            />
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
                {p.members!.map((pm, i) => {
                  const name =
                    pm.member?.displayName ||
                    pm.user?.name ||
                    pm.externalName ||
                    "?";
                  const avatarUrl =
                    pm.member?.user?.image ||
                    pm.member?.avatar ||
                    pm.user?.image ||
                    null;
                  return (
                    <span
                      key={pm.id}
                      className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] text-white border border-white overflow-hidden flex-shrink-0 ${
                        pm.member
                          ? "bg-brand-orange"
                          : pm.user
                            ? "bg-brand-blue"
                            : "bg-gray-500"
                      }`}
                      style={
                        {
                          "--overlap": `${overlap}px`,
                          marginLeft: i === 0 ? "0" : "calc(-1 * var(--overlap))",
                        } as React.CSSProperties
                      }
                      title={name}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        name[0]
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const wrapStyle = {
    "--anim-delay": delay,
    animation: `cardPopIn 0.45s var(--anim-delay) both`,
  } as React.CSSProperties;

  if (useLink) {
    return (
      <div className="h-full" style={wrapStyle}>
        <Link
          href={link}
          className={`${commonClassName} cursor-pointer opacity-100 transition-opacity duration-200`}
          {...hoverHandlers}
        >
          {cardContent}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full" style={wrapStyle}>
      <a
        href={link}
        onClick={handleClick}
        className={`${commonClassName} transition-opacity duration-200 ${
          clicking ? "cursor-default opacity-65" : "cursor-pointer opacity-100"
        }`}
        {...hoverHandlers}
      >
        {cardContent}
      </a>
    </div>
  );
}

export default React.memo(ProjectCard, (prev, next) => {
  return (
    prev.project === next.project &&
    prev.compact === next.compact &&
    prev.clicking === next.clicking &&
    prev.onCardClick === next.onCardClick
  );
});
