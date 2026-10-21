"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";

type Author = { id: string; name: string };
/** Matches the expanding + person picker used for course instructors and students. */
export default function ShowcaseAuthorPicker({ name, userId, options, onChange, personLabel = "作者" }: {
  personLabel?: string;
  name: string; userId: string | null; options: Author[];
  onChange: (author: { authorName: string; authorUserId: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const q = query.trim();
  const matches = options.filter((author) => author.name.toLocaleLowerCase().includes(q.toLocaleLowerCase())).slice(0, 20);
  const exact = options.find((author) => author.name.trim().toLocaleLowerCase() === q.toLocaleLowerCase());
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function close(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function choose(author?: Author) {
    if (!author && !q) return;
    onChange({ authorName: author?.name || q, authorUserId: author?.id || null });
    setOpen(false); setQuery("");
  }
  return <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-2">
      {name && !open && <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-surface px-2 py-1">
        <UserAvatar name={name} size={24} /><button type="button" title={`更改${personLabel}`} onClick={() => { setQuery(name); setOpen(true); }} className="min-w-0 truncate text-sm text-brand-navy">{name}</button>
        <button type="button" aria-label={`移除${personLabel}`} onClick={() => onChange({ authorName: "", authorUserId: null })} className="px-1 text-xs text-brand-text-muted">×</button>
      </span>}
      <div ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} className={`relative h-8 shrink-0 border bg-card transition-[width,border-radius,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "w-64 max-w-full rounded-lg border-brand-blue shadow-[0_0_0_2px_rgba(58,150,204,0.12)]" : "w-28 rounded-full border-brand-blue/20 bg-brand-blue/5 hover:border-brand-blue/50"}`}>
        <button type="button" aria-label={name ? `更改${personLabel}` : `添加${personLabel}`} aria-expanded={open} tabIndex={open ? -1 : 0} onClick={() => { setQuery(""); setOpen(true); }} className={`absolute inset-0 flex items-center justify-center gap-1.5 rounded-full text-xs font-medium text-brand-blue transition-[opacity,transform] duration-200 ${open ? "pointer-events-none scale-95 opacity-0" : "opacity-100"}`}><span>{name ? `更改${personLabel}` : `添加${personLabel}`}</span><svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
        <input ref={input} aria-label={`搜索或输入${personLabel}`} autoComplete="off" maxLength={100} tabIndex={open ? 0 : -1} aria-hidden={!open} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索站内用户或输入${personLabel}姓名`} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Escape") { event.preventDefault(); setOpen(false); } if (event.key === "Enter") { event.preventDefault(); choose(exact); } }} className={`h-full w-full min-w-0 bg-transparent px-3 text-sm text-brand-text-heading outline-none transition-opacity duration-200 ${open ? "opacity-100 delay-75" : "pointer-events-none opacity-0"}`} />
        {open && (matches.length > 0 || q) && <div className="absolute left-0 top-full z-40 mt-1 w-full overflow-hidden rounded-lg border border-brand-border-subtle bg-card shadow-lg"><div className="max-h-48 overflow-y-auto">
          {matches.map((author) => <button key={author.id} type="button" aria-label={author.name} onClick={() => choose(author)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-surface"><UserAvatar name={author.name} size={28} /><span className="min-w-0 flex-1 truncate text-sm text-brand-navy">{author.name}</span>{author.id === userId && <span className="text-brand-orange">✓</span>}</button>)}
          {q && !exact && <button type="button" onClick={() => choose()} className="w-full border-t border-brand-border-subtle px-3 py-2 text-left text-sm text-brand-blue hover:bg-brand-surface">添加「{q}」</button>}
        </div></div>}
      </div>
    </div>
  </div>;
}
