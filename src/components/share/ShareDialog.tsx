"use client";

import { useEffect, useRef, useState } from "react";
import { publicShareUrl, type ShareCardData, type ShareHeader } from "@/lib/share";
import type { Lang } from "@/lib/i18n/config";
import SharePoster from "./SharePoster";

export default function ShareDialog({ data, lang, onClose }: { data: ShareCardData; lang: Lang; onClose: () => void }) {
  const en = lang === "en";
  const [header, setHeader] = useState<ShareHeader>({ kind: "color", color: "blue" });
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const url = publicShareUrl(data.path);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 240, margin: 4, color: { dark: "#25547A", light: "#ffffff" }, errorCorrectionLevel: "M" }))
      .then(value => { if (!cancelled) setQr(value); })
      .catch(() => { if (!cancelled) setMessage(en ? "Could not create QR code. Please reopen to retry." : "二维码生成失败，请重新打开重试。"); });
    return () => { cancelled = true; };
  }, [url, en]);

  const renderPng = async (): Promise<Blob> => {
    if (!posterRef.current) throw new Error("Poster unavailable");
    const poster = posterRef.current;
    let restoreImages: (() => void) | undefined;
    try {
      const { prepareImagesForExport, renderElementToCanvas } = await import("@/lib/image-export");
      restoreImages = await prepareImagesForExport(poster);
      const canvas = await renderElementToCanvas(poster, { scale: 3, bg: "transparent" });
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
    } finally { restoreImages?.(); }
  };

  const save = async () => {
    if (!posterRef.current || busy || !qr) return;
    setBusy(true); setMessage("");
    try {
      const blob = await renderPng();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${data.title.replace(/[\\/:*?"<>|]/g, "-")}.png`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage(en ? "Image saved" : "分享图已保存");
    } catch {
      setMessage(en ? "Could not save the image. Please try again." : "图片保存失败，请重试。");
    } finally { setBusy(false); }
  };

  const copyImage = async () => {
    if (!posterRef.current || busy || !qr) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setMessage(en ? "This browser cannot copy images. Save the image instead." : "当前浏览器不支持复制图片，请保存后分享。");
      return;
    }
    setBusy(true); setMessage("");
    try {
      // Hand the promise to ClipboardItem immediately so the click's user activation is retained.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderPng() })]);
      setMessage("");
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1100);
    } catch {
      setMessage(en ? "Could not copy the image. Save it instead." : "复制图片失败，请保存后分享。");
    } finally { setBusy(false); }
  };

  return <dialog ref={dialogRef} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} aria-label={data.kind === "member" ? (en ? "Share profile" : "分享主页") : (en ? "Share activity" : "分享活动")} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-transparent p-0 text-white backdrop:bg-[#0a1823]/85 backdrop:backdrop-blur-md">
    <button type="button" onClick={onClose} aria-label={en ? "Close share dialog" : "关闭分享"} className="fixed right-4 top-3 z-20 flex h-11 w-11 items-center justify-center text-white/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-white sm:right-7 sm:top-5">
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" aria-hidden><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    <div onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="flex min-h-dvh items-center justify-center px-5 pb-6 pt-16 sm:px-8 sm:py-20">
      <div className="grid w-full max-w-[400px] items-center gap-6 md:max-w-[700px] md:grid-cols-[minmax(0,400px)_220px] md:gap-12">
        <div className="w-full overflow-hidden rounded-[20px] shadow-[0_24px_90px_rgba(0,0,0,0.3)]" ref={posterRef}><SharePoster data={data} lang={lang} header={header} qr={qr} /></div>
        <div className="flex flex-col gap-5" aria-label={en ? "Share controls" : "分享操作"}>
          {data.kind === "activity" && <fieldset disabled={busy} className="min-w-0">
            <legend className="mb-2 text-xs font-medium text-white/75">{en ? "Card header" : "卡头样式"}</legend>
            <div className="grid grid-cols-4 gap-2">
              {(["blue", "orange", "green", "navy"] as const).map(color => <button key={color} type="button" aria-label={en ? `${color} header` : `${{ blue: "蓝色", orange: "橙色", green: "绿色", navy: "深蓝色" }[color]}卡头`} aria-pressed={header.kind === "color" && header.color === color} onClick={() => setHeader({ kind: "color", color })} className={`h-10 rounded-lg border-2 transition-transform hover:-translate-y-0.5 ${header.kind === "color" && header.color === color ? "border-white" : "border-transparent"}`} style={{ background: { blue: "#3388BB", orange: "#D96F3E", green: "#88C232", navy: "#25547A" }[color] }} />)}
            </div>
            {!!data.headerImages?.length && <div className="mt-2 grid grid-cols-4 gap-2">{data.headerImages.slice(0, 8).map(item => <button key={item.url} type="button" title={item.title} aria-label={en ? `Use image: ${item.title}` : `使用图片：${item.title}`} aria-pressed={header.kind === "image" && header.url === item.url} onClick={() => setHeader({ kind: "image", url: item.url })} className={`h-12 overflow-hidden rounded-lg border-2 transition-transform hover:-translate-y-0.5 ${header.kind === "image" && header.url === item.url ? "border-white" : "border-transparent"}`}><img src={item.url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
          </fieldset>}
          <div className="flex overflow-hidden rounded-lg bg-[#E38043] text-white shadow-lg">
            <button type="button" disabled={busy || !qr} onClick={save} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-[#F09055] disabled:cursor-wait disabled:opacity-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
              {busy ? (en ? "Processing…" : "正在处理…") : (en ? "Save image" : "保存分享图")}
            </button>
            <button type="button" disabled={busy || !qr} onClick={copyImage} aria-label={en ? "Copy share image" : "复制分享图"} title={en ? "Copy share image" : "复制分享图"} className="inline-flex w-14 shrink-0 items-center justify-center border-l border-white/35 transition-colors hover:bg-[#F09055] disabled:cursor-wait disabled:opacity-50">
              {copied ? <svg className="shareCopySuccess" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4L19 6" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>}
            </button>
          </div>
          <p role="status" className={message ? "text-center text-xs text-white/90 md:text-left" : "sr-only"}>{message}</p>
        </div>
      </div>
    </div>
  </dialog>;
}
