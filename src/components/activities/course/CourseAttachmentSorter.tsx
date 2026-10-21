"use client";

import { useRef, useState } from "react";
import type { CourseAttachmentDraft } from "@/lib/activities/course-materials";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function CourseAttachmentSorter({
  title,
  items,
  image = false,
  onMove,
  onRemove,
}: {
  title: string;
  items: CourseAttachmentDraft[];
  image?: boolean;
  onMove: (from: string, to: string) => void;
  onRemove: (url: string) => void;
}) {
  const pointerDrag = useRef<{ pointerId: number; url: string; x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  function targetAt(x: number, y: number): string | null {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-course-attachment-url]");
    const url = element?.dataset.courseAttachmentUrl || null;
    return url && items.some((item) => item.url === url) ? url : null;
  }

  function resetDrag() {
    pointerDrag.current = null;
    setMoving(null);
    setOver(null);
  }

  return <div>
    <h4 className="mb-2 text-sm font-semibold text-brand-navy">{title}</h4>
    {items.length === 0 ? <p className="text-sm text-brand-text-muted">还没有{title}</p> : (
      <ul className={image ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-2"}>
        {items.map((file, index) => (
          <li
            key={file.url}
            data-course-attachment-url={file.url}
            tabIndex={0}
            aria-label={`排序${title}：${file.name}。按 Alt 加上下方向键调整顺序`}
            onKeyDown={(event) => {
              if (!event.altKey) return;
              if (event.key === "ArrowUp" && index > 0) {
                event.preventDefault();
                onMove(file.url, items[index - 1].url);
              } else if (event.key === "ArrowDown" && index < items.length - 1) {
                event.preventDefault();
                onMove(file.url, items[index + 1].url);
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
              pointerDrag.current = { pointerId: event.pointerId, url: file.url, x: event.clientX, y: event.clientY, moved: false };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = pointerDrag.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
              drag.moved = true;
              setMoving(drag.url);
              setOver(targetAt(event.clientX, event.clientY));
            }}
            onPointerUp={(event) => {
              const drag = pointerDrag.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const target = targetAt(event.clientX, event.clientY);
              if (drag.moved && target) onMove(drag.url, target);
              resetDrag();
            }}
            onPointerCancel={resetDrag}
            className={`group relative cursor-grab overflow-hidden rounded-lg border transition-[border-color,opacity,transform] active:cursor-grabbing touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue ${over === file.url ? "border-brand-blue" : "border-brand-border-subtle"} ${moving === file.url ? "opacity-55" : "opacity-100"} ${image ? "min-w-0 aspect-[4/3] bg-brand-surface" : "flex items-center gap-2 bg-card px-3 py-2"}`}
          >
            {image ? <>
              <img src={file.url} alt="" draggable={false} className="h-full w-full select-none object-cover" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-8 text-sm text-white" title={file.name}>{file.name}</span>
              <button type="button" aria-label={`移除${file.name}`} onClick={() => onRemove(file.url)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-base text-white hover:bg-black/75">×</button>
            </> : <>
              <span className="min-w-0 flex-1 truncate text-sm text-brand-navy" title={file.name}>{file.name}</span>
              {file.sizeBytes != null && <span className="shrink-0 text-xs text-brand-text-muted">{formatBytes(file.sizeBytes)}</span>}
              <button type="button" aria-label={`移除${file.name}`} onClick={() => onRemove(file.url)} className="shrink-0 px-1 text-sm text-red-500">×</button>
            </>}
          </li>
        ))}
      </ul>
    )}
  </div>;
}
