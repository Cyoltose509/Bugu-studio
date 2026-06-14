/**
 * 统一作品卡片组件 — 与 /works 的 WorkCard 保持一致
 *
 * 使用场景：
 * - /works (works slug page)
 * - 主页 (LatestProjects)
 * - /members/[id] (成员详情页)
 * - /profile (个人中心)
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useCallback, useMemo } from "react";
import MiniLikeButton from "./MiniLikeButton";
import ProjectCoverImage from "./ProjectCoverImage";

const TYPE_LABELS: Record<string, string> = {
  IN_DEVELOPMENT: "开发阶段",
  TRIAL_DEMO: "提供试玩",
  MINI_GAME: "小游戏",
  OFFICIAL_RELEASE: "正式上架",
};

// ── 类型 ─────────────────────────────────────────────────────────────────────────

export interface ProjectCardProject {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  type: string;
  developYear: number | null;
  status?: string; // 仅 /profile 使用
  awards?: string[];
  aiUsages?: string[];
  tags?: { tag: { slug: string; name: string } }[];
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
  /** 卡片链接，默认 `/works/${project.slug}` */
  href?: string;
  /** 是否显示状态角标（已发布/待审核），用于 /profile */
  showStatusBadge?: boolean;
  /** 是否紧凑模式（隐藏描述），用于主页 */
  compact?: boolean;
  /** 点击加载中状态，用于 /works 无限滚动 */
  clicking?: boolean;
  /** 点击回调，用于 /works 无限滚动（稳定引用） */
  onCardClick?: (id: string, slug: string) => void;
  /** 动画延迟（仅本地卡片用） */
  idx?: number;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

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

  // 头像动态重叠计算（useMemo 缓存）
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
    "group block bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md border-brand-border-subtle";

  // 点击处理
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onCardClick) {
      e.preventDefault();
      if (!clicking) onCardClick(p.id, p.slug);
    }
  }, [onCardClick, p.id, p.slug, clicking]);

  // 渲染卡片内容
  const cardContent = (
    <>
      {/* 加载遮罩 */}
      {clicking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/40 rounded-xl">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/90 shadow-lg text-brand-navy"
          >
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium">加载中…</span>
          </div>
        </div>
      )}

      {/* 封面图区域 */}
      <div className="relative aspect-video bg-brand-surface">
        {/* 🏆 奖项角标 + 🤖 AI 角标 */}
        <div className="absolute top-2 right-2 flex gap-0.5 text-lg z-10"
          data-ai={JSON.stringify(p.aiUsages)}
          data-awards={JSON.stringify(p.awards)}>
          {p.awards && p.awards.length > 0 && (
            <span title={p.awards.join("、")}>🏆</span>
          )}
          {p.aiUsages && p.aiUsages.length > 0 && (
            <span title="使用了 AI 技术">🤖</span>
          )}
        </div>

        {/* 状态角标（仅 /profile） */}
        {showStatusBadge && p.status && (
          <span
            className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm z-10 text-white ${p.status === "PUBLISHED" ? "bg-green-700/85" : "bg-orange-600/85"}`}
          >
            {p.status === "PUBLISHED" ? "已发布" : p.status === "PENDING" ? "待审核" : p.status}
          </span>
        )}

        <ProjectCoverImage src={p.coverImage} alt={p.title} priority={idx === 0} />
        {!p.coverImage && (
          <div className="w-full h-full flex items-center justify-center">
            <Image src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
          </div>
        )}

        {/* 类型角标 */}
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">
            {TYPE_LABELS[p.type] || p.type}
          </span>
        </div>
      </div>

      {/* 卡片内容区 */}
      <div className="p-4">
        <h3
          className="font-semibold group-hover:text-[#3388BB] transition-colors flex items-baseline gap-1.5 text-brand-text-heading"
        >
          <span className="truncate">{p.title}</span>
          {p.subtitle && (
            <span className="text-xs font-normal flex-shrink-0 text-brand-text-muted">
              {p.subtitle}
            </span>
          )}
        </h3>
        {!compact && (
          <p className="text-sm mt-1 line-clamp-2 text-brand-text-secondary">
            {p.description}
          </p>
        )}
        {p.tags && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.tags!.slice(0, 3).map(({ tag }) => (
              <span
                key={tag.slug}
                className="text-xs px-1.5 py-0.5 rounded bg-brand-green/15 text-brand-green"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3">
          {/* 年份 */}
          {p.developYear && (
            <span className="text-xs flex-shrink-0 text-brand-text-muted">
              {p.developYear}
            </span>
          )}
          <div className="flex-1" />
          {/* ❤️ + 头像：右对齐，动态重叠 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MiniLikeButton
              projectId={p.id}
              initialCount={p._count?.likes ?? 0}
              initialLiked={p.liked ?? false}
            />
            {n > 0 && (
              <div className="flex items-center overflow-hidden" style={{ "--avatar-max-w": `${maxW}px`, maxWidth: "var(--avatar-max-w)" } as React.CSSProperties}>
                {p.members!.map((pm, i) => {
                  const name =
                    pm.member?.displayName ||
                    pm.user?.name ||
                    pm.externalName ||
                    "?";
                  const avatarUrl =
                    pm.member?.user?.image || pm.member?.avatar || pm.user?.image || null;
                  return (
                    <span
                      key={pm.id}
                      className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] text-white border border-white overflow-hidden flex-shrink-0 ${
                        pm.member ? "bg-brand-orange" : pm.user ? "bg-brand-blue" : "bg-gray-500"
                      }`}
                      style={{ "--overlap": `${overlap}px`, marginLeft: i === 0 ? "0" : "calc(-1 * var(--overlap))" } as React.CSSProperties}
                      title={name}
                    >
                      {avatarUrl ? (
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

  if (useLink) {
    return (
      <div style={{ "--anim-delay": delay, animation: `cardPopIn 0.45s var(--anim-delay) both` } as React.CSSProperties}>
        <Link
          href={link}
          className={`${commonClassName} cursor-pointer opacity-100 transition-opacity duration-200`}
        >
          {cardContent}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ "--anim-delay": delay, animation: `cardPopIn 0.45s var(--anim-delay) both` } as React.CSSProperties}>
      <a
        href={link}
        onClick={handleClick}
        className={`${commonClassName} transition-opacity duration-200 ${clicking ? "cursor-default opacity-65" : "cursor-pointer opacity-100"}`}
      >
        {cardContent}
      </a>
    </div>
  );
}

/*
 * React.memo：
 * - 只有 project / compact / clicking / onCardClick 发生变化时才 re-render
 * - onCardClick 现在通过 useCallback 保持稳定引用
 */
export default React.memo(ProjectCard, (prev, next) => {
  return (
    prev.project === next.project &&
    prev.compact === next.compact &&
    prev.clicking === next.clicking &&
    prev.onCardClick === next.onCardClick
  );
});
