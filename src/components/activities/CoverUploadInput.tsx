"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { uploadImage, ACCEPT_ATTR, compressionNote, assertImageFile } from "@/lib/utils/clientUpload";
import { useLang } from "@/lib/i18n/LangProvider";

interface Props {
  defaultValue?: string;
  name?: string;
}

export default function CoverUploadInput({ defaultValue, name = "coverImage" }: Props) {
  const { t, lang } = useLang();
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [coverUrl, setCoverUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const uploadFile = useCallback(async (file: File) => {
    try {
      assertImageFile(file, lang);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("upload.selectImage"));
      return;
    }
    setError("");
    setNote("");
    setUploading(true);
    const previousPreview = preview;
    const previousUrl = coverUrl;

    try {
      setPreview(URL.createObjectURL(file));

      // 原图在限额内就原样上传，超了才压缩
      const result = await uploadImage(file, {
        endpoint: "/api/upload/cover",
        type: "cover",
        lang,
      });

      setCoverUrl(result.url);
      setPreview(result.url);
      setNote(compressionNote(result, lang));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("form.uploadFailed"));
      setNote("");
      setPreview(previousPreview);
      setCoverUrl(previousUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [coverUrl, preview, lang, t]);

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
        aria-label={hasCustom ? t("upload.changeCoverAria") : t("upload.uploadCoverAria")}
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
          alt={t("form.coverPreviewAlt")}
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
            <span className="text-sm font-medium tracking-wide">{t("form.uploading")}</span>
          ) : dragging ? (
            <>
              <span className="text-sm font-semibold">{t("upload.dropToUpload")}</span>
              <span className="text-xs text-white/80">JPG / PNG / WebP</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                {hasCustom ? t("form.changeCover") : t("upload.uploadCover")}
              </span>
              <span className="text-xs text-white/80">{t("upload.dragImageHere")}</span>
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
      {!error && note && <p className="text-xs text-brand-text-muted">{note}</p>}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onFileInput}
      />
      <input type="hidden" name={name} value={coverUrl} />
    </div>
  );
}
