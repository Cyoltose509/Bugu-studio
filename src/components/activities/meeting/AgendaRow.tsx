import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";

export function agendaTypeLabel(
  type: string | null | undefined,
  share: string,
  showcase: string,
) {
  return type === "SHOWCASE" ? showcase : share;
}

export function AgendaTypeTag({
  type,
  label,
}: {
  type: string | null | undefined;
  label: string;
}) {
  const showcase = type === "SHOWCASE";
  return (
    <span
      className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
        showcase ? "agenda-chip-showcase" : "agenda-chip-share"
      }`}
    >
      {label}
    </span>
  );
}

export function AgendaSpeaker({
  name,
  href,
  image,
  byLabel,
}: {
  name: string;
  href?: string | null;
  image?: string | null;
  byLabel: string;
}) {
  const inner = (
    <>
      <span className="text-brand-text-muted">{byLabel}</span>
      <UserAvatar src={image} name={name} size={22} />
      <span className="max-w-[8rem] truncate text-brand-text-secondary">{name}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-1.5 shrink-0 text-xs hover:text-brand-blue"
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-1.5 shrink-0 text-xs">{inner}</span>
  );
}
