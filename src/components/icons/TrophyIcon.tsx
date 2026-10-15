import Image from "next/image";

/**
 * 微软风格奖杯图标 — 替代 🏆 emoji。
 *
 * 图片：/images/trophy.png（自带透明通道，240×240）。
 * 注意：作为行内图标使用时，用 className 配 `align-[-0.15em]` 与文字基线对齐。
 */
export default function TrophyIcon({
  size = 16,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/images/trophy.png"
      alt=""
      width={size}
      height={size}
      title={title}
      aria-hidden
      className={`inline-block shrink-0 object-contain select-none ${className}`}
    />
  );
}
