import { bilibiliWatchUrl } from "@/lib/activities/constants";

/** 小电视图标，点击跳转 B 站录像 */
export default function BilibiliTvLink({
  bvId,
  className = "",
}: {
  bvId: string;
  className?: string;
}) {
  return (
    <a
      href={bilibiliWatchUrl(bvId)}
      target="_blank"
      rel="noopener noreferrer"
      title={`在 B 站观看 ${bvId}`}
      aria-label={`在 B 站观看 ${bvId}`}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-brand-border-subtle bg-card text-[#00A1D6] hover:bg-[#00A1D6]/10 hover:border-[#00A1D6]/40 transition-colors shrink-0 ${className}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
        <path d="M6.2 4.8 4.8 6.2 7.6 9H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3.6l2.8-2.8-1.4-1.4L13.4 9h-2.8L6.2 4.8ZM4 11h16v8H4v-8Zm6 1.5v5l4.5-2.5L10 12.5Z" />
      </svg>
    </a>
  );
}
