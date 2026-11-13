"use client";

import { useRef, useState } from "react";
import { uploadImage, ACCEPT_ATTR } from "@/lib/utils/clientUpload";
import { readFileAsDataURL } from "@/lib/utils/imageCrop";
import { useImageDrop } from "@/components/ui/ImageDropZone";
import PlusIcon from "@/components/ui/PlusIcon";

export default function CourseScheduleMenu({ image, onImage, onAdd, previewOnly = false }: {
  image: string; onImage: (url: string) => void; onAdd: () => void; previewOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { dragging, zoneRef, dropProps } = useImageDrop({
    onFile: (file) => upload(file),
    onInvalid: setError,
    disabled: busy,
  });
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("请选择课程表图片");
      const url = previewOnly ? await readFileAsDataURL(file) : (await uploadImage(file, { endpoint: "/api/upload/attachment", type: "attachment" })).url;
      onImage(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "上传失败"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div {...dropProps} ref={zoneRef} tabIndex={0} data-image-dropzone="true" className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" aria-label="添加课程安排；可拖入或粘贴课程表图片" aria-expanded={open} disabled={busy} onClick={() => setOpen(!open)} className={`grid h-9 w-9 place-items-center rounded-lg border bg-brand-blue/10 text-brand-blue transition hover:bg-brand-blue/20 disabled:opacity-50 ${dragging ? "border-brand-blue ring-2 ring-brand-blue/40 bg-brand-blue/20" : "border-brand-blue/20"}`}><PlusIcon size={18} strokeWidth={2} /></button>
    {dragging && <span className="pointer-events-none absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-lg bg-brand-blue px-2 py-1 text-xs text-white shadow-lg">松开以上传课程表</span>}
    {open && <div className="absolute right-0 top-full z-40 mt-2 w-40 rounded-xl border border-brand-blue/20 bg-card p-1.5 shadow-xl shadow-brand-blue/10">
      <button type="button" onClick={() => { setOpen(false); onAdd(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-text-body hover:bg-brand-blue/10"><PlusIcon size={16} className="text-brand-blue" />新增条目</button>
      <button type="button" onClick={() => { input.current?.click(); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-text-body hover:bg-brand-blue/10"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m3 17 6-6 5 5 3-3 4 4" /></svg>{image ? "更换课程表" : "上传课程表"}</button>
    </div>}
    <input ref={input} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
    {busy && <span role="status" className="absolute right-0 top-full whitespace-nowrap text-xs text-brand-text-muted">上传中…</span>}
    {error && <p role="alert" className="absolute right-0 top-full z-40 w-52 rounded-lg bg-card p-2 text-xs text-red-500 shadow-lg">{error}</p>}
  </div>;
}
