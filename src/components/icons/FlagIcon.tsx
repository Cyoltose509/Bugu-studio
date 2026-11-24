/**
 * 微软 Fluent UI Emoji 扁平版小红旗图标（Triangular Flag Flat, U+1F6A9）
 */
export default function FlagIcon({
  size = 14,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={!title}
      data-icon="fluent-triangular-flag-flat"
      className={`inline-block shrink-0 select-none ${className}`}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M27.6259 11.9438L8 4H7V21H8L27.6259 13.0562C28.1258 12.8538 28.1258 12.1462 27.6259 11.9438Z"
        fill="#F8312F"
      />
      <path
        d="M4 4C4 2.89543 4.89543 2 6 2C7.10457 2 8 2.89543 8 4V30H4V4Z"
        fill="#E39D89"
      />
    </svg>
  );
}
