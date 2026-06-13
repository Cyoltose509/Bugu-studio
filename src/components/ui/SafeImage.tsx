"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * 服务端安全的图片封装
 * 使用 next/Image 优化加载，onError 使用占位符代替 display:none 防止 CLS
 */
export default function SafeImage({
  src,
  alt = "",
  className,
  loading,
  style,
  width,
  height,
  fill,
}: {
  src: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const [error, setError] = useState(false);

  if (error) {
    const arStyle = width && height
      ? { aspectRatio: `${width}/${height}` }
      : {};
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${className}`}
        style={{ ...style, ...arStyle }}
      >
        🖼
      </div>
    );
  }

  // Blob/Data URLs 不经过 next/Image 优化
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        style={style}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      onError={() => setError(true)}
      fill={fill}
      width={!fill ? (width || 400) : undefined}
      height={!fill ? (height || 300) : undefined}
      sizes={fill ? undefined : "(max-width: 768px) 100vw, 50vw"}
    />
  );
}
