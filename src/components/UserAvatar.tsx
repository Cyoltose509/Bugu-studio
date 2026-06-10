"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * 统一的用户头像组件
 * 使用 next/Image 优化加载，fallback 到首字母
 * 通过设置 width/height 防止 CLS
 */
export default function UserAvatar({
  src,
  name,
  size = 32,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();

  if (!src || error) {
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4, background: "#E38043" }}
      >
        {initial}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name || ""}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className}`}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      sizes={`${size}px`}
      unoptimized={src.startsWith("blob:") || src.startsWith("data:")}
    />
  );
}
