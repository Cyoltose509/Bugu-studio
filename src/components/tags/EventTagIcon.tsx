import { eventIconSrc } from "@/lib/tags/event-tags";

export default function EventTagIcon({
  slug,
  className = "w-3 h-3 shrink-0 rounded-[2px] object-contain",
}: {
  slug: string;
  className?: string;
}) {
  const src = eventIconSrc(slug);
  if (!src) return null;
  return <img src={src} alt="" width={12} height={12} className={className} />;
}
