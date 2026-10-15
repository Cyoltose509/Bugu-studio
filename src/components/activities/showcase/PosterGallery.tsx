"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ActivityShowcase } from "@/lib/activities/showcase";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

export default function PosterGallery({ posters, featured = false }: {
  posters: ActivityShowcase["posters"]; featured?: boolean;
}) {
  const { lang } = useLang();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  if (!posters.length) return null;
  const poster = posters[Math.min(selected, posters.length - 1)];
  return <>
    <div className={featured ? "w-full max-w-sm mx-auto" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
      {posters.map((poster, index) => <figure key={`${poster.url}-${index}`} className="min-w-0">
        <button type="button" onClick={() => { setSelected(index); dialog.current?.showModal(); }}
          aria-label={t(lang, "showcase.poster.zoomAria", { title: poster.title })}
          className="block w-full rounded-2xl overflow-hidden border border-brand-border-subtle bg-card shadow-sm transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">
          <div className="relative aspect-[1054/1492]">
            <Image src={poster.url} alt={poster.title} fill className="object-contain"
              sizes={featured ? "(max-width: 640px) 90vw, 384px" : "(max-width: 640px) 90vw, 360px"}
              priority={featured && index === 0} />
          </div>
        </button>
        <figcaption className="mt-3 text-sm text-brand-text-secondary">{poster.title} <span className="text-brand-blue">{t(lang, "showcase.poster.clickHint")}</span></figcaption>
      </figure>)}
    </div>
    <dialog ref={dialog} aria-label={poster.title}
      className="m-auto max-w-[96vw] max-h-[94dvh] rounded-xl bg-card p-3 backdrop:bg-black/80"
      onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="mb-3 flex items-center justify-between gap-4 text-brand-text-heading">
        <span className="text-sm">{poster.title}</span>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t(lang, "showcase.poster.closeAria")} className="rounded-lg border px-3 py-1">{t(lang, "showcase.poster.close")}</button>
      </div>
      <img src={poster.url} alt={poster.title} className="mx-auto max-h-[78dvh] max-w-full object-contain" />
      <a href={poster.url} target="_blank" rel="noreferrer" className="mt-2 block text-center text-sm text-brand-blue underline">{t(lang, "showcase.poster.openFull")}</a>
    </dialog>
  </>;
}
