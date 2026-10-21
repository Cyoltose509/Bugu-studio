"use client";

import { useRef, useState } from "react";

export default function ShowcaseTitleEditor({ title, onChange }: { title: string; onChange: (title: string) => void }) {
  const [editing, setEditing] = useState(!title);
  const [draft, setDraft] = useState(title);
  const cancelled = useRef(false);
  function edit() { cancelled.current = false; setDraft(title); setEditing(true); }
  return <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-12">
    {editing ? <input autoFocus aria-label="作品名称" maxLength={160} value={draft} placeholder="作品名称" onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (!cancelled.current) onChange(draft.trim()); setEditing(false); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { cancelled.current = true; setEditing(false); } }} className="w-full min-w-0 border-b border-white/50 bg-transparent py-1 text-base font-semibold text-white outline-none placeholder:text-white/60 focus:border-white" /> : <div className="flex items-center gap-2">
      <button type="button" onClick={edit} className="min-w-0 break-words text-left text-base font-semibold leading-snug text-white">{title || "作品名称"}</button>
      <button type="button" aria-label="编辑作品名称" title="编辑作品名称" onClick={edit} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/15"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></button>
    </div>}
  </div>;
}
