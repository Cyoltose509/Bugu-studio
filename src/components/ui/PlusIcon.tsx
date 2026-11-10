/** Symmetric, font-independent plus used by add and increment controls. */
export default function PlusIcon({ size = 20, strokeWidth = 2.2, className = "" }: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true" focusable="false" className={`block shrink-0 ${className}`}>
    <path d="M12 5v14M5 12h14" />
  </svg>;
}
