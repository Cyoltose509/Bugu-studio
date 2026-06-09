"use client";

import { useRef, useState } from "react";

const DEFAULT_COVER = "/images/default_pic.png";

interface Props {
  defaultValue?: string;
  name?: string;
}

export default function CoverUploadInput({ defaultValue, name = "coverImage" }: Props) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [coverUrl, setCoverUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      // 本地预览
      setPreview(URL.createObjectURL(file));

      // 压缩（>300KB 时缩放到 1920x1080）
      let uploadFile = file;
      if (file.size > 300 * 1024) {
        const { compressImage } = await import("@/lib/utils/imageCrop");
        uploadFile = await compressImage(file, 1920, 1080, 0.8);
      }

      const fd = new FormData();
      fd.append("file", uploadFile, uploadFile.name || file.name);
      const res = await fetch("/api/upload/cover", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");

      setCoverUrl(json.url);
    } catch (err: any) {
      setError(err.message || "上传失败");
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const displaySrc = preview || DEFAULT_COVER;

  return (
    <div>
      <div className="flex items-start gap-4">
        {/* 预览 */}
        <div className="shrink-0">
          <img
            src={displaySrc}
            alt="封面预览"
            className="w-40 h-24 object-cover rounded-lg border"
            style={{ borderColor: "#D0DEE8" }}
          />
        </div>

        {/* 操作 */}
        <div className="flex-1 space-y-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: "#D0DEE8", color: "#555" }}
          >
            {uploading ? "上传中..." : preview && preview !== DEFAULT_COVER ? "更换封面" : "选择封面图"}
          </button>
          {!uploading && coverUrl && (
            <span className="text-xs ml-2" style={{ color: "#88C232" }}>✓ 已上传</span>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs" style={{ color: "#999" }}>
            留空则使用默认封面，支持 JPG/PNG/WebP，最大 5MB
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
      </div>

      {/* hidden input 将 url 提交到 FormData */}
      <input type="hidden" name={name} value={coverUrl} />
    </div>
  );
}
