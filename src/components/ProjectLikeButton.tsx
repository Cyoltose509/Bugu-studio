"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

interface Props {
  projectId: string;
  initialCount: number;
  initialLiked?: boolean;
}

export default function ProjectLikeButton({ projectId, initialCount, initialLiked }: Props) {
  const { data: session, status } = useSession();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [animating, setAnimating] = useState(false);
  const [canLike, setCanLike] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  // session 加载完成后拉取准确状态
  useEffect(() => {
    if (status === "loading") return;
    const controller = new AbortController();

    const can = !!(session?.user?.id && session.user.role !== "GUEST");
    setCanLike(can);

    fetch(`/api/projects/${projectId}/like`, { method: "GET", signal: controller.signal })
      .then((r) => r.json())
      .then((d: any) => {
        setCount(d.likeCount ?? initialCount);
        setLiked(d.liked ?? initialLiked ?? false);
        setCanLike(d.canLike ?? can);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [projectId, initialCount, initialLiked, status]);

  const toggle = useCallback(async () => {
    if (!canLike) return;

    // 取消上一次未完成的请求，允许快速连点
    if (abortRef.current) abortRef.current.abort();

    const intendedLiked = !likedRef.current;
    // 乐观更新
    setLiked(intendedLiked);
    setCount((c) => (intendedLiked ? c + 1 : c - 1));
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/projects/${projectId}/like`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });
      if (controller.signal.aborted) return;

      const json = await res.json();
      if (!res.ok) {
        // 回滚
        setLiked(!intendedLiked);
        setCount((c) => (intendedLiked ? c - 1 : c + 1));
      } else {
        // 以服务端返回值为准
        setLiked(json.liked);
        setCount(json.likeCount);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return; // 被新请求取消，无需回滚
      // 网络错误：回滚
      setLiked(!intendedLiked);
      setCount((c) => (intendedLiked ? c - 1 : c + 1));
    }
  }, [canLike, projectId]);

  return (
    <button
      onClick={toggle}
      disabled={!canLike}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all select-none ${
        !canLike ? "opacity-40 cursor-not-allowed" : "hover:shadow-sm hover:brightness-95 active:brightness-90"
      }`}
      style={{
        background: liked ? "rgba(227,128,67,0.12)" : "#F0F5F9",
        border: `1.5px solid ${liked ? "#E38043" : "#D0DEE8"}`,
        transform: animating ? "scale(1.15)" : "scale(1)",
        color: liked ? "#E38043" : "#555",
      }}
      aria-label={liked ? "取消点赞" : "点赞"}
      title={!canLike ? "登录后方可点赞" : liked ? "取消点赞" : "点赞"}
      type="button"
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
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
