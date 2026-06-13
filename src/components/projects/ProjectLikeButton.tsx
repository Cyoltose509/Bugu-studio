"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [loading, setLoading] = useState(false);

  // session 加载完成后：若未提供 initialLiked 则拉取服务端真实状态
  useEffect(() => {
    if (status === "loading") return;
    if (initialLiked !== undefined) {
      // 服务端已提供 liked 状态，无需额外 GET 请求
      const can = !!(session?.user?.id && session.user.role !== "GUEST");
      setCanLike(can);
      return;
    }

    const can = !!(session?.user?.id && session.user.role !== "GUEST");
    setCanLike(can);

    fetch(`/api/projects/${projectId}/like`, { method: "GET" })
      .then((r) => r.json())
      .then((d: any) => {
        const body = d.data ?? d;
        setCount(body.likeCount ?? initialCount);
        setLiked(body.liked ?? false);
        setCanLike(body.canLike ?? can);
      })
      .catch(() => {});
  }, [projectId, initialCount, initialLiked, status, session]);

  const toggle = useCallback(async () => {
    if (!canLike || loading) return;

    setLoading(true);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);

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
      // 失败时不改变状态
    } catch {
      // 网络错误：保持当前状态
    } finally {
      setLoading(false);
    }
  }, [canLike, loading, projectId]);

  const isDisabled = !canLike || loading;

  return (
    <button
      onClick={toggle}
      disabled={isDisabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all select-none ${
        isDisabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm hover:brightness-95 active:brightness-90"
      }`}
      style={{
        background: liked ? "rgba(227,128,67,0.12)" : "#F0F5F9",
        border: `1.5px solid ${liked ? "#E38043" : "#D0DEE8"}`,
        transform: animating ? "scale(1.15)" : "scale(1)",
        color: liked ? "#E38043" : "#555",
      }}
      title={loading ? (liked ? "取消点赞中…" : "点赞中…") : !canLike ? "登录后方可点赞" : liked ? "取消点赞" : "点赞"}
      type="button"
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
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
      )}
      <span className="font-medium">
        {loading ? (liked ? "取消中…" : "点赞中…") : count}
      </span>
    </button>
  );
}
