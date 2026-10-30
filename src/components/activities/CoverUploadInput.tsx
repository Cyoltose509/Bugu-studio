"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { uploadImage, ACCEPT_ATTR, compressionNote, assertImageFile } from "@/lib/utils/clientUpload";
import { useLang } from "@/lib/i18n/LangProvider";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";

interface Props {
  defaultValue?: string;
  name?: string;
  previewClassName?: string;
  /** 叠在封面上的标题（活动卡合成预览） */
  title?: string;
  /** 叠在封面上的简介；空则不渲染 */
  summary?: string;
  activityType?: string;
  typeLabel?: string;
  allowFocalPoint?: boolean;
  initialFocusX?: number;
  initialFocusY?: number;
  /** 可直接选用的现成图片（如议程配图）；点击即设为封面，不再上传 */
  presetImages?: string[];
}

export default function CoverUploadInput({
  defaultValue,
  name = "coverImage",
  previewClassName,
  title,
  summary,
  activityType,
  typeLabel,
  allowFocalPoint = false,
  initialFocusX = 50,
  initialFocusY = 50,
  presetImages,
}: Props) {
  const { t, lang } = useLang();
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [coverUrl, setCoverUrl] = useState(defaultValue || "");
  const [focusX, setFocusX] = useState(initialFocusX);
  const [focusY, setFocusY] = useState(initialFocusY);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const uploadFile = useCallback(async (file: File) => {
    try {
      await assertImageFile(file, lang);
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
  const overlayTitle = title?.trim() || "";
  const overlaySummary = summary?.trim() || "";
  const showComposite = Boolean(overlayTitle || overlaySummary || typeLabel);

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
          `group relative w-full ${previewClassName ?? "max-w-md"} aspect-video overflow-hidden rounded-xl border cursor-pointer`,
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
          style={allowFocalPoint ? { objectPosition: `${focusX}% ${focusY}%` } : undefined}
        />

        {typeLabel && <ActivityTypeCorner type={activityType || ""} label={typeLabel} />}

        {showComposite && (
          <div className="absolute inset-x-0 bottom-0 z-[1] pointer-events-none bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-16 px-4 pb-3.5">
            {overlayTitle ? (
              <p className="text-white text-base sm:text-lg font-semibold leading-snug line-clamp-2 drop-shadow-sm">
                {overlayTitle}
              </p>
            ) : (
              <p className="text-white/55 text-base sm:text-lg font-medium leading-snug">标题将显示在这里</p>
            )}
            {overlaySummary ? (
              <p className="mt-1.5 text-white/85 text-sm leading-relaxed line-clamp-2">{overlaySummary}</p>
            ) : null}
          </div>
        )}

        {/* 拖拽 / 上传时全幅提示；平时只在右上角露出更换入口，不盖住合成预览 */}
        {uploading || dragging ? (
          <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-black/50 text-white">
            {uploading ? (
              <span className="text-sm font-medium tracking-wide">{t("form.uploading")}</span>
            ) : (
              <>
                <span className="text-sm font-semibold">{t("upload.dropToUpload")}</span>
                <span className="text-xs text-white/80">JPG / PNG / WebP</span>
              </>
            )}
          </div>
        ) : (
          <div className="absolute top-2 right-2 z-[2] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200">
            <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-md bg-black/55 text-white">
              {hasCustom ? t("form.changeCover") : t("upload.uploadCover")}
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 z-[3] h-1 overflow-hidden bg-white/20">
            <div className="cover-upload-bar absolute inset-y-0 left-0 w-1/2 bg-brand-orange" />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && note && <p className="text-xs text-brand-text-muted">{note}</p>}

      {presetImages && presetImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-brand-text-muted">从议程配图选择</span>
          {presetImages.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setCoverUrl(url);
                setPreview(url);
                setNote("");
                setError("");
              }}
              title="选用为封面"
              aria-label="选用为封面"
              className={`h-12 w-20 shrink-0 overflow-hidden rounded-lg border transition ${
                coverUrl === url
                  ? "border-brand-blue ring-2 ring-brand-blue/40"
                  : "border-brand-border-subtle hover:border-brand-blue/50"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onFileInput}
      />
      <input type="hidden" name={name} value={coverUrl} />
      {allowFocalPoint && <div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-border-subtle p-3">
        <label className="text-xs text-brand-text-muted">封面焦点 · 横向<input type="range" min={0} max={100} value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} className="mt-1 block w-full accent-brand-blue" /></label>
        <label className="text-xs text-brand-text-muted">封面焦点 · 纵向<input type="range" min={0} max={100} value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} className="mt-1 block w-full accent-brand-blue" /></label>
        <input type="hidden" name="courseCoverFocusX" value={focusX} /><input type="hidden" name="courseCoverFocusY" value={focusY} />
      </div>}
    </div>
  );
}
