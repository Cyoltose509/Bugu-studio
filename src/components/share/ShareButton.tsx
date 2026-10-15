"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ShareCardData } from "@/lib/share";
import { useLang } from "@/lib/i18n/LangProvider";

const ShareDialog = dynamic(() => import("./ShareDialog"), { ssr: false });

export default function ShareButton({ data, label }: { data: ShareCardData; label?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const { lang } = useLang();
  useEffect(() => {
    if (!open && wasOpen.current) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return <>
    <button ref={buttonRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-brand-border-subtle bg-card px-4 py-2 text-sm font-medium text-brand-text-heading transition-colors hover:border-brand-blue hover:text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 16V3m-5 5 5-5 5 5M5 14v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label || (lang === "en" ? "Share" : "分享")}
    </button>
    {open && <ShareDialog data={data} lang={lang} onClose={() => setOpen(false)} />}
  </>;
}
