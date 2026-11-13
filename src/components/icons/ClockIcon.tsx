/**
 * 时钟线性图标 — 用于日期输入框右侧的时间选择按钮。
 * 内联 SVG，颜色跟随 currentColor，不额外加载图片资源。
 */
export default function ClockIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}
