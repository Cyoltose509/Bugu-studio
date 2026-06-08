"use client";

/**
 * 服务端安全的 <img> 封装
 * - 放在 "use client" 组件中，支持 onError 事件处理器
 * - 用于在 Server Component 中需要容错图片的场景
 */
export default function SafeImage({
  src,
  alt = "",
  className,
  loading,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
