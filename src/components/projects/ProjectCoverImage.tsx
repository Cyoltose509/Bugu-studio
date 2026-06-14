"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

/**
 * 作品封面图客户端组件
 *
 * 渐进式加载策略：
 * 1. 卡片文字内容即时渲染（不受封面图影响）
 * 2. 封面区域显示灰色骨架脉冲动画
 * 3. 图片加载完成后淡入（opacity 过渡 500ms）
 * 4. 非首图使用 loading="lazy" + decoding="async"，浏览器自然逐个加载
 * 5. 处理浏览器缓存（img.complete 为 true 时跳过骨架）
 */
export default function ProjectCoverImage({
  src,
  alt,
  priority,
  compact,
  fallbackSrc = "/images/logo.png",
  className,
  fillParent = true,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  compact?: boolean;
  fallbackSrc?: string;
  className?: string;
  fillParent?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const defaultClass = fillParent
    ? "absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    : "object-cover group-hover:scale-105 transition-transform duration-300";
  const imgClass = className || defaultClass;

  // 处理浏览器缓存：图片可能早已加载完成（complete = true）
  useEffect(() => {
    if (imgRef.current?.complete && !imgError) {
      setLoaded(true);
    }
  }, [src, imgError]);

  // ── 无封面图：显示 fallback logo ──
  if (!src || imgError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <img src={fallbackSrc} alt="" width={40} height={40} className="opacity-30" />
      </div>
    );
  }

  // ── 骨架占位（封面加载中） ──
  const skeleton = (
    <div
      className={`absolute inset-0 bg-gray-200 animate-pulse transition-opacity duration-500 ${
        loaded ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    />
  );

  const isRemote = src.startsWith("http");

  if (isRemote) {
    return (
      <>
        {skeleton}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`${imgClass} aspect-video transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      </>
    );
  }

  // 本地图片用 next/image
  return (
    <>
      {skeleton}
      <Image
        src={src}
        alt={alt}
        fill={fillParent}
        className={`object-cover group-hover:scale-105 transition-transform duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } transition-opacity duration-500`}
        sizes={compact ? "(max-width:768px) 100vw, 25vw" : "(max-width:768px) 100vw, 33vw)"}
        onLoad={() => setLoaded(true)}
        onError={() => setImgError(true)}
        {...(priority ? { priority: true, fetchPriority: "high" as const } : {})}
      />
    </>
  );
}
