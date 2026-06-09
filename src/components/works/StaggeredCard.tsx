"use client";

import Link from "next/link";
import MiniLikeButton from "@/components/MiniLikeButton";
import ProjectCoverImage from "@/components/ProjectCoverImage";

const TYPE_LABELS: Record<string, string> = {
  DEMO: "Demo 演示",
  STEAM: "Steam 发布",
  ITCH: "itch.io 发布",
  OTHER: "其他",
};

interface Props {
  project: any;
  members: any[];
  idx: number;
  liked: boolean;
  typeLabels: Record<string, string>;
}

/** 单张作品卡片 — 带逐个弹出动画 */
export default function StaggeredCard({ project: p, members, idx, liked, typeLabels }: Props) {
  const delay = `${idx * 70}ms`;

  return (
    <div style={{ animation: `cardPopIn 0.45s ${delay} both` }}>
      <Link
        href={`/works/${p.slug}`}
        className="game-card group bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md block"
        style={{ borderColor: "#D0DEE8" }}
      >
        <div className="relative aspect-video" style={{ background: "#E6F0F8" }}>
          <ProjectCoverImage src={p.coverImage} alt={p.title} priority={idx === 0} />
          {!p.coverImage && (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "#E6F0F8" }}>
              <img src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">
              {typeLabels[p.type]}
            </span>
          </div>
          {p.isFeatured && (
            <div className="absolute top-2 right-2">
              <span className="text-xs px-2 py-0.5 rounded text-white" style={{ background: "#E38043" }}>
                精选
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3
            className="font-semibold group-hover:text-[#3388BB] transition-colors line-clamp-1"
            style={{ color: "#333" }}
          >
            {p.title}
          </h3>
          <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>
            {p.description}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.tags.slice(0, 3).map(({ tag }: any) => (
              <span
                key={tag.slug}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232" }}
              >
                {tag.name}
              </span>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs" style={{ color: "#999" }}>
              {p.developYear}
            </span>
            <div className="flex items-center gap-2">
              <MiniLikeButton
                projectId={p.id}
                initialCount={p._count.likes}
                initialLiked={liked}
              />
              <div className="flex -space-x-1">
                {members.slice(0, 3).map((pm: any) => {
                  const name = pm.member?.displayName || pm.externalName || "?";
                  const avatarUrl = pm.member
                    ? pm.member.user?.image || pm.member.avatar
                    : null;
                  return (
                    <div
                      key={pm.id}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white border border-white overflow-hidden"
                      style={{ background: pm.member ? "#E38043" : "#6B7280" }}
                      title={name}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        name[0]
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
