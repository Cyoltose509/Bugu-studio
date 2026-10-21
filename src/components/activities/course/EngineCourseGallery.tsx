"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type GalleryItem = { authorName?: string; id: string; title: string; imageUrl: string; projectSlug: string | null };

export default function EngineCourseGallery({ items, fullWidth = false }: { items: GalleryItem[]; fullWidth?: boolean }) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = previous; };
  }, [selected]);
  if (!items.length) return null;
  return <>
    <div className={fullWidth ? "grid grid-cols-1" : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
      {items.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} className={`group relative overflow-hidden rounded-xl bg-brand-surface text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue ${fullWidth ? "w-full" : "aspect-[4/3]"}`}>
        <img src={item.imageUrl} alt="" loading="lazy" className={fullWidth ? "max-h-[42rem] w-full object-contain" : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"} />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 text-sm font-semibold text-white">{item.title}{item.authorName && <span className="mt-1 block text-xs font-normal text-white/75">{item.authorName}</span>}</span>
      </button>)}
    </div>
    {selected && <div role="dialog" aria-modal="true" aria-label={selected.title} className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-4" onClick={() => setSelected(null)}>
      <div className="flex items-center justify-between gap-4 text-white"><h3 className="text-lg font-semibold">{selected.title}{selected.authorName && <span className="ml-3 text-sm font-normal text-white/70">{selected.authorName}</span>}</h3><button type="button" onClick={() => setSelected(null)} className="p-2 text-3xl leading-none" aria-label="关闭">×</button></div>
      <div className="flex min-h-0 flex-1 items-center justify-center"><img src={selected.imageUrl} alt={selected.title} className="max-h-full max-w-full object-contain" /></div>
      {selected.projectSlug && <div className="pb-2 pt-3 text-center"><Link href={`/works/${selected.projectSlug}`} onClick={(event) => event.stopPropagation()} className="rounded-full border border-white/40 px-5 py-2 text-sm text-white hover:bg-white/15">查看作品详细 →</Link></div>}
    </div>}
  </>;
}
