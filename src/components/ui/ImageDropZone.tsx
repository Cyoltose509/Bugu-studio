"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { assertImageFile } from "@/lib/utils/clientUpload";

interface UseImageDropOptions {
  /** 收到一个合法图片文件时触发（只取第一个文件） */
  onFile: (file: File) => void | Promise<void>;
  /** 文件类型不合法时的回调（GIF、非图片等） */
  onInvalid?: (message: string) => void;
  disabled?: boolean;
  /** 是否顺手拦住"拖到页面空白处导致浏览器直接打开图片"的默认行为 */
  guardDocument?: boolean;
  /** 文档级粘贴接管：页面任意处 Ctrl+V 图片都进这个区域（仅单上传区场景使用；
   *  多区域同开时先挂载者先得，靠 preventDefault 去重）。默认仅区域内粘贴。 */
  globalPaste?: boolean;
}

/** 从剪贴板事件里取第一张图片文件 */
function imageFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/**
 * 拖拽导入 Hook。
 *
 * dragenter/dragleave 在子元素之间穿梭时会反复触发，所以用 depth 计数，
 * 归零才算真正离开容器，否则拖过子元素时高亮会闪。
 */
export function useImageDrop({
  onFile,
  onInvalid,
  disabled = false,
  guardDocument = true,
  globalPaste = false,
}: UseImageDropOptions) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onInvalidRef = useRef(onInvalid);
  onInvalidRef.current = onInvalid;
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  // 拖到页面空白处时，浏览器默认会用图片替换当前页面 —— 表单内容就丢了
  useEffect(() => {
    if (!guardDocument) return;
    const prevent = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (!Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
    };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, [guardDocument]);

  // 粘贴：globalPaste 时接管整页粘贴；否则仅在区域（含其内获得焦点的子元素）内生效
  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      // 先挂载的 globalPaste 区域已处理 → 跳过
      if (e.defaultPrevented) return;
      const file = imageFromClipboard(e);
      if (!file) return; // 纯文本粘贴不碰
      if (!globalPaste) {
        const zone = zoneRef.current;
        if (!zone || !zone.contains(document.activeElement)) return;
      } else {
        // 焦点落在别的上传区内时让位，避免多面板同开时抢粘贴
        const activeZone = document.activeElement?.closest("[data-image-dropzone]");
        if (activeZone && activeZone !== zoneRef.current) return;
      }
      e.preventDefault();
      void assertImageFile(file)
        .then(() => onFileRef.current(file))
        .catch((err) =>
          onInvalidRef.current?.(err instanceof Error ? err.message : "不支持的文件"),
        );
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [disabled, globalPaste]);

  const hasFiles = (e: React.DragEvent) => {
    const types = e.dataTransfer?.types;
    return !!types && Array.from(types).includes("Files");
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (disabledRef.current) return;
    depth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = disabledRef.current ? "none" : "copy";
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setDragging(false);
    if (disabledRef.current) return;

    const files = Array.from(e.dataTransfer.files || []);
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) return;

    try {
      await assertImageFile(file);
    } catch (err) {
      onInvalidRef.current?.(err instanceof Error ? err.message : "不支持的文件");
      return;
    }
    void onFile(file);
  };

  return {
    dragging,
    zoneRef,
    dropProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
}

interface ImageDropZoneProps extends UseImageDropOptions {
  children: React.ReactNode;
  className?: string;
  /** 拖拽悬停时遮罩上的文案 */
  hint?: string;
  /** 遮罩额外样式 */
  overlayClassName?: string;
}

/**
 * 通用图片导入容器：把任意现有 UI 包一层就能接 拖拽 / 粘贴。
 * 点击选择由 children 自带的 file input 负责。容器可聚焦（Tab/点击后）
 * 以便区域内 Ctrl+V 粘贴生效。
 */
export function ImageDropZone({
  children,
  className,
  hint = "松开即可上传",
  overlayClassName,
  ...opts
}: ImageDropZoneProps) {
  const { dragging, zoneRef, dropProps } = useImageDrop(opts);

  return (
    <div
      {...dropProps}
      ref={zoneRef}
      tabIndex={0}
      data-image-dropzone="true"
      data-dragging={dragging ? "true" : undefined}
      className={clsx("relative outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 rounded-xl", className)}
    >
      {children}
      {dragging && (
        <div
          className={clsx(
            "pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-1",
            "rounded-xl border-2 border-dashed border-brand-blue bg-brand-blue/10",
            "text-sm font-medium text-brand-blue",
            overlayClassName,
          )}
        >
          <span>{hint}</span>
          <span className="text-xs opacity-75">JPG / PNG / WebP / GIF · 支持拖入与粘贴</span>
        </div>
      )}
    </div>
  );
}
