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
  /** 点击开始回调，用于 /works 无限滚动 */
  onClickStart?: (e: React.MouseEvent) => void;
  /** 动画延迟（仅本地卡片用） */
  idx?: number;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

export default function ProjectCard({
  project: p,
  href,
  showStatusBadge = false,
  compact = false,
  clicking = false,
  onClickStart,
  idx = 0,
}: ProjectCardProps) {
  const link = href ?? `/works/${p.slug}`;
  const delay = `${Math.min(idx % 16, 15) * 50}ms`;

  // 头像动态重叠计算
  const n = p.members?.length ?? 0;
  const avatarSize = 20;
  const maxW = 155;
  const normalOverlap = 6;
  const totalW = avatarSize + (n - 1) * (avatarSize - normalOverlap);
  const overlap =
    totalW > maxW
      ? Math.max(2, Math.min(avatarSize - 2, (n * avatarSize - maxW) / Math.max(1, n - 1)))
      : normalOverlap;

  const useLink = !onClickStart;
  const commonClassName =
    "group block bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md";
  const commonStyle = { borderColor: "#D0DEE8" as string };

  // 点击处理
  const handleClick = (e: React.MouseEvent) => {
    if (onClickStart) {
      e.preventDefault();
      if (!clicking) onClickStart(e);
    }
  };

  // 渲染卡片内容
  const cardContent = (
    <>
      {/* 加载遮罩 */}
      {clicking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 rounded-xl">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 shadow-lg"
            style={{ color: "#25547A" }}
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
      <div className="relative aspect-video" style={{ background: "#E6F0F8" }}>
        {/* 🏆 奖项角标 */}
        {p.awards && p.awards.length > 0 && (
          <div className="absolute top-2 right-2 text-lg z-10" title={p.awards.join("、")}>
            🏆
          </div>
        )}

        {/* 状态角标（仅 /profile） */}
        {showStatusBadge && p.status && (
          <span
            className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm z-10"
            style={{
              background:
                p.status === "PUBLISHED"
                  ? "rgba(46,125,50,0.85)"
                  : "rgba(230,81,0,0.85)",
              color: "#fff",
            }}
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
          className="font-semibold group-hover:text-[#3388BB] transition-colors flex items-baseline gap-1.5"
          style={{ color: "#333" }}
        >
          <span className="truncate">{p.title}</span>
          {p.subtitle && (
            <span className="text-xs font-normal flex-shrink-0" style={{ color: "#999" }}>
              {p.subtitle}
            </span>
          )}
        </h3>
        {!compact && (
          <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>
            {p.description}
          </p>
        )}
        {p.tags && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.tags!.slice(0, 3).map(({ tag }) => (
              <span
                key={tag.slug}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232" }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3">
          {/* 年份 */}
          {p.developYear && (
            <span className="text-xs flex-shrink-0" style={{ color: "#999" }}>
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
              <div className="flex items-center overflow-hidden" style={{ maxWidth: `${maxW}px` }}>
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
                      className="inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] text-white border border-white overflow-hidden flex-shrink-0"
                      style={{
                        background: pm.member
                          ? "#E38043"
                          : pm.user
                          ? "#3388BB"
                          : "#6B7280",
                        marginLeft: i === 0 ? 0 : `-${overlap}px`,
                      }}
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
      <div style={{ animation: `cardPopIn 0.45s ${delay} both` }}>
        <Link
          href={link}
          className={commonClassName}
          style={{
            ...commonStyle,
            cursor: "pointer",
            opacity: 1,
            transition: "opacity 0.2s",
          }}
        >
          {cardContent}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ animation: `cardPopIn 0.45s ${delay} both` }}>
      <a
        href={link}
        onClick={handleClick}
        className={commonClassName}
        style={{
          ...commonStyle,
          cursor: clicking ? "default" : "pointer",
          opacity: clicking ? 0.65 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {cardContent}
      </a>
    </div>
  );
}
