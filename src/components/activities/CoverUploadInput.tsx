"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";

interface Props {
  defaultValue?: string;
  name?: string;
}

export default function CoverUploadInput({ defaultValue, name = "coverImage" }: Props) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [coverUrl, setCoverUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件（JPG / PNG / WebP）");
      return;
    }
    setError("");
    setUploading(true);
    const previousPreview = preview;
    const previousUrl = coverUrl;

    try {
      setPreview(URL.createObjectURL(file));

      let uploadFileBlob = file;
      if (file.size > 300 * 1024) {
        const { compressImage } = await import("@/lib/utils/imageCrop");
        uploadFileBlob = await compressImage(file, 1920, 1080, 0.8);
      }

      const fd = new FormData();
      fd.append("file", uploadFileBlob, uploadFileBlob.name || file.name);
      const res = await fetch("/api/upload/cover", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");

      setCoverUrl(json.url);
      setPreview(json.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上传失败");
      setPreview(previousPreview);
      setCoverUrl(previousUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [coverUrl, preview]);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  const displaySrc = preview || DEFAULT_ACTIVITY_COVER;
  const hasCustom = Boolean(coverUrl || (preview && preview !== DEFAULT_ACTIVITY_COVER));

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={hasCustom ? "点击或拖拽以更换封面" : "点击或拖拽以上传封面"}
        onClick={() => !uploading && fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) fileRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          "group relative w-full max-w-md aspect-video overflow-hidden rounded-xl border cursor-pointer",
          "bg-brand-surface outline-none transition-[box-shadow,border-color,transform] duration-200",
          "focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
          dragging
            ? "border-brand-blue shadow-[0_0_0_3px_rgba(51,136,187,0.25)] scale-[1.01]"
            : "border-brand-border-subtle hover:border-brand-blue/50",
          uploading ? "pointer-events-none" : "",
        ].join(" ")}
      >
        <img
          src={displaySrc}
          alt="封面预览"
          className={[
            "absolute inset-0 h-full w-full object-cover transition duration-300",
            dragging || uploading ? "scale-[1.03] blur-[1px]" : "group-hover:scale-[1.02]",
          ].join(" ")}
          draggable={false}
        />

        {/* 悬停 / 拖拽遮罩 */}
        <div
          className={[
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5",
            "bg-black/0 text-white transition-all duration-200",
            dragging
              ? "bg-black/45 opacity-100"
              : "opacity-0 group-hover:bg-black/40 group-hover:opacity-100",
            uploading ? "bg-black/50 opacity-100" : "",
          ].join(" ")}
        >
          {uploading ? (
            <span className="text-sm font-medium tracking-wide">上传中…</span>
          ) : dragging ? (
            <>
              <span className="text-sm font-semibold">松开以上传</span>
              <span className="text-xs text-white/80">JPG / PNG / WebP</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                {hasCustom ? "更换封面" : "上传封面"}
              </span>
              <span className="text-xs text-white/80">点击或拖拽图片到此处</span>
            </>
          )}
        </div>

        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-white/20">
            <div className="cover-upload-bar absolute inset-y-0 left-0 w-1/2 bg-brand-orange" />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileInput}
      />
      <input type="hidden" name={name} value={coverUrl} />
    </div>
  );
}
