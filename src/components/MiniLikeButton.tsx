"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  projectId: string;
  initialCount: number;
}

export default function MiniLikeButton({ projectId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/like`, { method: "GET", signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setCount(d.likeCount ?? initialCount);
        setLiked(d.liked ?? false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [projectId, initialCount]);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 取消上一次未完成的请求
    if (abortRef.current) abortRef.current.abort();

    const intendedLiked = !likedRef.current;
    setLiked(intendedLiked);
    setCount((c) => (intendedLiked ? c + 1 : c - 1));

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
        setLiked(!intendedLiked);
        setCount((c) => (intendedLiked ? c - 1 : c + 1));
      } else {
        setLiked(json.liked);
        setCount(json.likeCount);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setLiked(!intendedLiked);
      setCount((c) => (intendedLiked ? c - 1 : c + 1));
    }
  }, [projectId]);

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5 transition-colors"
      style={{
        background: liked ? "rgba(227,128,67,0.12)" : "transparent",
        color: liked ? "#E38043" : "#bbb",
      }}
      type="button"
      title={liked ? "取消点赞" : "点赞"}
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24"
        fill={liked ? "#E38043" : "none"}
        stroke={liked ? "#E38043" : "currentColor"}
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span>{count}</span>
    </button>
  );
}
