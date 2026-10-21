"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { getCroppedImg, readFileAsDataURL } from "@/lib/utils/imageCrop";
import { uploadImage } from "@/lib/utils/clientUpload";

const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false }) as any;

export default function CourseImagePicker({
  value,
  iconPlacement = "center",
  previewOnly = false,
  onChange,
  aspect = 16 / 9,
  label = "上传图片",
  className = "",
}: {
  previewOnly?: boolean;
  iconPlacement?: "center" | "corner";
  value: string;
  onChange: (url: string) => void;
  aspect?: number;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!source) return;
    function dismiss(event: KeyboardEvent) { if (event.key === "Escape" && !busy) setSource(null); }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", dismiss);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", dismiss); };
  }, [source, busy]);

  async function select(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    try { setSource(await readFileAsDataURL(file)); } catch { setError("图片读取失败，请重新选择"); return; }
    setPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }
  async function confirm() {
    if (!source || !pixels) return;
    setBusy(true);
    try {
      const { blob, url } = await getCroppedImg(source, pixels, 1600, 0.88);
      URL.revokeObjectURL(url);
      if (previewOnly) {
        onChange(await readFileAsDataURL(new File([blob], "course-image.jpg", { type: "image/jpeg" })));
        setSource(null);
        return;
      }
      const result = await uploadImage(new File([blob], "course-image.jpg", { type: "image/jpeg" }), { endpoint: "/api/upload/attachment", type: "attachment" });
      onChange(result.url);
      setSource(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片上传失败");
    } finally { setBusy(false); }
  }
  return <>
    <button type="button" aria-label={label} title={label} draggable={false} onDragStart={(event) => event.preventDefault()} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); void select(e.dataTransfer.files?.[0]); }} className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed transition ${dragging ? "border-brand-blue bg-brand-blue/10" : "border-brand-border-subtle bg-brand-surface-page hover:border-brand-blue/60"} ${className}`}>
      {value && <img src={value} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      <span className={`pointer-events-none flex h-9 w-9 items-center justify-center ${iconPlacement === "corner" ? "absolute right-12 top-2 rounded-lg" : "relative rounded-full"} ${value ? "bg-card/95 text-brand-blue shadow-sm" : "bg-brand-blue/10 text-brand-blue"}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" /></svg></span>
    </button>
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void select(e.target.files?.[0]); e.target.value = ""; }} />
    {error && !source && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    {source && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && setSource(null)}>
      <div role="dialog" aria-modal="true" aria-label="裁剪图片" className="w-full max-w-xl overflow-hidden bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-[min(58vh,420px)] bg-black"><Cropper image={source} crop={crop} zoom={zoom} aspect={aspect} showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_: any, area: any) => setPixels(area)} /></div>
        {error && <p role="alert" className="px-3 pt-3 text-sm text-red-500">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-brand-border-subtle p-3"><span className="text-xs text-brand-text-muted">拖动图片调整构图</span><input aria-label="缩放" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="min-w-0 flex-1 basis-24 accent-brand-blue" /><button type="button" disabled={busy} onClick={() => setSource(null)} className="btn-secondary rounded-lg px-3 py-2 text-sm">取消</button><button type="button" disabled={busy || !pixels} onClick={() => void confirm()} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">{busy ? "上传中…" : "使用这张"}</button></div>
      </div>
    </div>}
  </>;
}
