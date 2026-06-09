"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import SafeImage from "./SafeImage";

interface ImageItem {
  src: string;
  alt: string;
  /** "cover" | "screenshot" */
  kind: "cover" | "screenshot";
}

interface Props {
  coverImage?: string | null;
  coverAlt: string;
  screenshots: { id: string; url: string; altText?: string | null }[];
}

/**
 * 作品图片画廊：封面 + 截图 → 点击弹出灯箱大图查看
 */
export default function ImageGallery({ coverImage, coverAlt, screenshots }: Props) {
  // 构建统一图片列表
  const allImages: ImageItem[] = [];
  if (coverImage) allImages.push({ src: coverImage, alt: coverAlt, kind: "cover" });
  for (const img of screenshots) {
    allImages.push({ src: img.url, alt: img.altText || coverAlt, kind: "screenshot" });
  }

  const [lightbox, setLightbox] = useState<{ index: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const open = useCallback((index: number) => setLightbox({ index }), []);
  const close = useCallback(() => setLightbox(null), []);

  const goPrev = useCallback(() => {
    setLightbox((prev) => {
      if (!prev) return null;
      return { index: prev.index === 0 ? allImages.length - 1 : prev.index - 1 };
    });
  }, [allImages.length]);

  const goNext = useCallback(() => {
    setLightbox((prev) => {
      if (!prev) return null;
      return { index: prev.index === allImages.length - 1 ? 0 : prev.index + 1 };
    });
  }, [allImages.length]);

  // 键盘：ESC 关闭 / ← → 切换
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    // 禁止背景滚动
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, close, goPrev, goNext]);

  // 无图片时不渲染
  if (allImages.length === 0) return null;

  // 将 cover 和 screenshots 分离（便于区分布局）
  const coverItem = allImages.find((i) => i.kind === "cover");
  const screenshotItems = allImages.filter((i) => i.kind === "screenshot");

  return (
    <>
      {/* ── 封面（大图） ── */}
      {coverItem && (
        <div
          className="relative aspect-video w-full max-w-2xl rounded-xl overflow-hidden mb-6 border cursor-zoom-in group"
          style={{ borderColor: "#D0DEE8" }}
          onClick={() => open(0)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") open(0); }}
          aria-label="查看封面大图"
        >
          <img
            src={coverItem.src}
            alt={coverItem.alt}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* 悬浮提示 */}
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            🔍 查看大图
          </div>
        </div>
      )}

      {/* ── 截图网格 ── */}
      {screenshotItems.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>游戏截图</h2>
          <div className="grid grid-cols-2 gap-3">
            {screenshotItems.map((img, i) => {
              const globalIdx = coverItem ? i + 1 : i;
              return (
                <div
                  key={i}
                  className="relative aspect-video rounded-lg overflow-hidden border hover:border-[#3388BB] transition-colors cursor-zoom-in group"
                  style={{ borderColor: "#D0DEE8" }}
                  onClick={() => open(globalIdx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") open(globalIdx); }}
                  aria-label={`查看截图 ${i + 1} 大图`}
                >
                  <SafeImage
                    src={img.src}
                    alt={img.alt}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    🔍 查看大图
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 灯箱弹窗 ── */}
      {lightbox && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
          onClick={(e) => { if (e.target === overlayRef.current) close(); }}
        >
          {/* 关闭按钮 */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>

          {/* 图片计数 */}
          <div className="absolute top-4 left-4 z-10 text-white/80 text-sm">
            {lightbox.index + 1} / {allImages.length}
          </div>

          {/* 上一张 */}
          {allImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
              aria-label="上一张"
            >
              ‹
            </button>
          )}

          {/* 当前大图 */}
          <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center">
            <img
              src={allImages[lightbox.index].src}
              alt={allImages[lightbox.index].alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-fade-in"
              key={lightbox.index}
            />
          </div>

          {/* 下一张 */}
          {allImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
              aria-label="下一张"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
