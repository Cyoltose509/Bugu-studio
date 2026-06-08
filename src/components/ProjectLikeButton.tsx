"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  projectId: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function ProjectLikeButton({ projectId, initialCount, initialLiked }: Props) {
  // 立即使用服务端传入的初始值，不等待 session 检查，保证 SSR 一致
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [animating, setAnimating] = useState(false);
  const [canLike, setCanLike] = useState(false);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);

  // 客户端挂载后异步获取准确的点赞状态（静默更新，不闪烁）
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    fetch(`/api/projects/${projectId}/like`, { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !mountedRef.current) return;
        setCount(d.likeCount ?? initialCount);
        setLiked(d.liked ?? initialLiked);
        setCanLike(d.canLike ?? false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, initialCount, initialLiked]);

  const toggle = useCallback(async () => {
    if (!canLike || pendingRef.current) return;
    pendingRef.current = true;

    // 乐观更新：立即切换 UI
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? c - 1 : c + 1));
    setAnimating(true);
    setTimeout(() => setAnimating(false), 350);

    try {
      const res = await fetch(`/api/projects/${projectId}/like`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        // 回滚
        setLiked(wasLiked);
        setCount((c) => (wasLiked ? c + 1 : c - 1));
      } else {
        // 服务端确认
        setLiked(json.liked);
        setCount(json.likeCount);
      }
    } catch {
      // 回滚
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : c - 1));
    } finally {
      pendingRef.current = false;
    }
  }, [canLike, liked, projectId]);

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all select-none ${
        !canLike ? "opacity-60 cursor-default" : "hover:shadow-sm"
      }`}
      style={{
        background: liked ? "rgba(227,128,67,0.12)" : "#F0F5F9",
        border: `1.5px solid ${liked ? "#E38043" : "#D0DEE8"}`,
        transform: animating ? "scale(1.25)" : "scale(1)",
        color: liked ? "#E38043" : "#777",
      }}
      aria-label={liked ? "取消点赞" : "点赞"}
      title={!canLike ? "登录后即可点赞" : liked ? "取消点赞" : "点赞"}
      type="button"
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24"
        fill={liked ? "#E38043" : "none"}
        stroke={liked ? "#E38043" : "currentColor"}
        strokeWidth="2"
        className="transition-transform"
        style={{ transform: animating ? "scale(1.3)" : "scale(1)" }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span className="font-medium">{count}</span>
    </button>
  );
}
