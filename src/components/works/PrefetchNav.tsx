"use client";

/**
 * 在页面渲染完成后，后台预取相邻作品的 RSC payload。
 * 这样用户点"上一个/下一个"时无需等待。
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrefetchNav({
  prevSlug,
  nextSlug,
  sort,
}: {
  prevSlug?: string | null;
  nextSlug?: string | null;
  sort?: string;
}) {
  const router = useRouter();
  const sortQS = sort && sort !== "date" ? `?sort=${sort}` : "";

  useEffect(() => {
    // 用 requestIdleCallback 延迟执行，不阻塞主线程
    const prefetch = () => {
      if (prevSlug) router.prefetch(`/works/${prevSlug}${sortQS ? sortQS : ""}`);
      if (nextSlug) router.prefetch(`/works/${nextSlug}${sortQS ? sortQS : ""}`);
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(prefetch, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    // fallback：下一个事件循环再 prefetch
    const id = setTimeout(prefetch, 0);
    return () => clearTimeout(id);
  }, [prevSlug, nextSlug, sortQS, router]);

  return null;
}
