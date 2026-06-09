"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  projectId: string;
  initialCount: number;
}

export default function MiniLikeButton({ projectId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const seqRef = useRef(0);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  useEffect(() => {
    const seq = ++seqRef.current;
    fetch(`/api/projects/${projectId}/like`, { method: "GET" })
      .then((r) => r.json())
      .then((d: any) => {
        if (seq !== seqRef.current) return;
        const body = d.data ?? d;
        setCount(body.likeCount ?? initialCount);
        setLiked(body.liked ?? false);
      })
      .catch(() => {});
  }, [projectId, initialCount]);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const intendedLiked = !likedRef.current;
    const seq = ++seqRef.current;

    // 乐观更新
    setLiked(intendedLiked);
    setCount((c) => (intendedLiked ? c + 1 : c - 1));

    try {
      const res = await fetch(`/api/projects/${projectId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (seq !== seqRef.current) return;

      const json = await res.json();
      if (seq !== seqRef.current) return;

      const body = json.data ?? json;

      if (!res.ok) {
        setLiked(!intendedLiked);
        setCount((c) => (intendedLiked ? c - 1 : c + 1));
      } else {
        setLiked(body.liked);
        setCount(body.likeCount);
      }
    } catch {
      if (seq !== seqRef.current) return;
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
