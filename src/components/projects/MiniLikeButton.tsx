"use client";

import { useState, useCallback } from "react";

interface Props {
  projectId: string;
  initialCount: number;
  initialLiked?: boolean;
}

export default function MiniLikeButton({ projectId, initialCount, initialLiked = false }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  // 服务端已提供 like 状态，无需客户端再请求 GET

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      const body = json.data ?? json;

      if (res.ok) {
        setLiked(body.liked);
        setCount(body.likeCount);
      }
    } catch {
      // 网络错误：保持当前状态
    } finally {
      setLoading(false);
    }
  }, [loading, projectId]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5 transition-colors cursor-pointer ${liked ? "bg-brand-orange/10" : "bg-transparent"} ${loading ? "text-[#ccc]" : liked ? "text-brand-orange" : "text-[#bbb]"}`}
      title={loading ? (liked ? "取消点赞中…" : "点赞中…") : (liked ? "取消点赞" : "点赞")}
      type="button"
    >
      {loading ? (
        <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg
          width="13" height="13" viewBox="0 0 24 24"
          fill={liked ? "#E38043" : "none"}
          stroke={liked ? "#E38043" : "currentColor"}
          strokeWidth="2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      )}
      <span>{loading ? "…" : count}</span>
    </button>
  );
}
