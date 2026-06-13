"use client";

import Image from "next/image";

/**
 * 作品封面图客户端组件
 * - 使用 next/image（本地 logo）或原生 <img>（远程 R2 图）
 * - 支持 onError 隐藏损坏图片
 * - 需要 "use client" 因为使用了 onError 事件处理器
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
  const defaultClass = fillParent
    ? "absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    : "object-cover group-hover:scale-105 transition-transform duration-300";
  const imgClass = className || defaultClass;

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <img src={fallbackSrc} alt="" width={40} height={40} className="opacity-30" />
      </div>
    );
  }

  // R2 远程图片用原生 <img>（避免 next/image 优化代理失败），同时保持宽高比防 CLS
  const isRemote = src.startsWith("http");

  if (isRemote) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${imgClass} aspect-video`}
        loading={priority ? "eager" : "lazy"}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // 本地图片用 next/image
  return (
    <Image
      src={src}
      alt={alt}
      fill={fillParent}
      className={`object-cover group-hover:scale-105 transition-transform duration-300 ${className || ""}`.trim()}
      sizes={compact ? "(max-width:768px) 100vw, 25vw" : "(max-width:768px) 100vw, 33vw"}
      {...(priority ? { priority: true, fetchPriority: "high" as const } : {})}
    />
  );
}
