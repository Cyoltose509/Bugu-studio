"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Props {
  projectId: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function ProjectLikeButton({ projectId, initialCount, initialLiked }: Props) {
  const { data: session } = useSession();
  const canLike = !!session?.user && session.user.role !== "GUEST";
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [animating, setAnimating] = useState(false);

  // 从服务端拿到的初始值可能不准确，客户端再查一次
  useEffect(() => {
    if (!session?.user) return;
    fetch(`/api/projects/${projectId}/like`, { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success !== false) {
          setCount(d.likeCount ?? initialCount);
          setLiked(d.liked ?? initialLiked);
        }
      })
      .catch(() => {});
  }, [projectId, session?.user, initialCount, initialLiked]);

  async function toggle() {
    if (!canLike) return;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    try {
      const res = await fetch(`/api/projects/${projectId}/like`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setLiked(json.liked);
        setCount(json.likeCount);
      }
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      disabled={!canLike}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all select-none disabled:opacity-50"
      style={{
        background: liked ? "rgba(227,128,67,0.12)" : "#F0F5F9",
        border: `1px solid ${liked ? "#E38043" : "#D0DEE8"}`,
        transform: animating ? "scale(1.3)" : "scale(1)",
        color: liked ? "#E38043" : "#777",
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill={liked ? "#E38043" : "none"}
        stroke={liked ? "#E38043" : "currentColor"}
        strokeWidth="2"
        className="transition-all"
        style={{ transform: animating ? "scale(1.2)" : "scale(1)" }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
