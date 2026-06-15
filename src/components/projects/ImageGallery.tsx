"use client";

import {useState, useCallback, useEffect, useRef} from "react";
import { createPortal } from "react-dom";
import SafeImage from "../ui/SafeImage";

interface ImageItem {
    src: string;
    alt: string;
    /** "cover" | "screenshot" */
    kind: "cover" | "screenshot";
}

interface Props {
    coverImage?: string | null;
    coverAlt: string;
    screenshots: { id: string; url: string; altText?: string | null }[];
}

/** 灯箱缩放/拖拽状态 */
interface Transform {
    scale: number;
    x: number;
    y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

/**
 * 作品图片画廊：封面 + 截图 → 点击弹出灯箱大图查看（支持缩放+拖拽）
 */
export default function ImageGallery({coverImage, coverAlt, screenshots}: Props) {
    const allImages: ImageItem[] = [];
    if (coverImage) allImages.push({src: coverImage, alt: coverAlt, kind: "cover"});
    for (const img of screenshots) {
        allImages.push({src: img.url, alt: img.altText || coverAlt, kind: "screenshot"});
    }

    const [lightbox, setLightbox] = useState<{ index: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [transform, setTransform] = useState<Transform>({scale: 1, x: 0, y: 0});
    const overlayRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // 客户端挂载后才 Portal，避免 SSR 报错
    useEffect(() => { setMounted(true); }, []);

    // 拖拽状态
    const dragging = useRef(false);
    const dragStart = useRef({mx: 0, my: 0, tx: 0, ty: 0});

    const resetTransform = useCallback(() => setTransform({scale: 1, x: 0, y: 0}), []);

    const open = useCallback((index: number) => {
        setLightbox({index});
        resetTransform();
    }, [resetTransform]);

    const close = useCallback(() => {
        setLightbox(null);
        resetTransform();
    }, [resetTransform]);

    const goPrev = useCallback(() => {
        setLightbox((prev) => {
            if (!prev) return null;
            return {index: prev.index === 0 ? allImages.length - 1 : prev.index - 1};
        });
        resetTransform();
    }, [allImages.length, resetTransform]);

    const goNext = useCallback(() => {
        setLightbox((prev) => {
            if (!prev) return null;
            return {index: prev.index === allImages.length - 1 ? 0 : prev.index + 1};
        });
        resetTransform();
    }, [allImages.length, resetTransform]);

    // 键盘：ESC 关闭 / ← → 切换 / +- 缩放
    useEffect(() => {
        if (!lightbox) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowLeft") goPrev();
            else if (e.key === "ArrowRight") goNext();
            else if (e.key === "=" || e.key === "+") {
                setTransform(t => ({...t, scale: Math.min(MAX_SCALE, t.scale + 0.5)}));
            } else if (e.key === "-") {
                setTransform(t => {
                    const ns = Math.max(MIN_SCALE, t.scale - 0.5);
                    return ns === MIN_SCALE ? {scale: 1, x: 0, y: 0} : {...t, scale: ns};
                });
            }
        };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [lightbox, close, goPrev, goNext]);

    // 鼠标滚轮缩放
    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        setTransform(t => {
            const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale + delta));
            if (ns === MIN_SCALE) return {scale: 1, x: 0, y: 0};
            return {...t, scale: ns};
        });
    }, []);

    // 拖拽：mousedown
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (transform.scale <= 1) return;
        e.preventDefault();
        dragging.current = true;
        dragStart.current = {mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y};
    }, [transform]);

    // 拖拽：mousemove（挂到 overlay 上）
    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        setTransform(t => ({...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy}));
    }, []);

    const onMouseUp = useCallback(() => {
        dragging.current = false;
    }, []);

    // 触摸缩放（pinch）
    const lastDist = useRef(0);
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastDist.current = Math.sqrt(dx * dx + dy * dy);
        } else if (e.touches.length === 1 && transform.scale > 1) {
            dragging.current = true;
            dragStart.current = {mx: e.touches[0].clientX, my: e.touches[0].clientY, tx: transform.x, ty: transform.y};
        }
    }, [transform]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ratio = dist / (lastDist.current || dist);
            lastDist.current = dist;
            setTransform(t => {
                const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * ratio));
                if (ns === MIN_SCALE) return {scale: 1, x: 0, y: 0};
                return {...t, scale: ns};
            });
        } else if (e.touches.length === 1 && dragging.current) {
            const dx = e.touches[0].clientX - dragStart.current.mx;
            const dy = e.touches[0].clientY - dragStart.current.my;
            setTransform(t => ({...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy}));
        }
    }, []);

    const onTouchEnd = useCallback(() => {
        dragging.current = false;
    }, []);

    // 双击重置
    const onDblClick = useCallback(() => {
        resetTransform();
    }, [resetTransform]);

    if (allImages.length === 0) return null;

    const coverItem = allImages.find((i) => i.kind === "cover");
    const screenshotItems = allImages.filter((i) => i.kind === "screenshot");
    const isZoomed = transform.scale > 1;

    return (
        <div className="mb-8 space-y-6">
            {/* ── 封面（大图） ── */}
            {coverItem && (
                <div
                    className="relative aspect-video rounded-xl overflow-hidden border cursor-zoom-in group border-brand-border-subtle"
                    onClick={() => open(0)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") open(0); }}
                    aria-label="查看封面大图"
                >
                    <img
                        src={coverItem.src}
                        alt={coverItem.alt}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        🔍 查看大图
                    </div>
                </div>
            )}

            {/* ── 截图缩略图 ── */}
            {screenshotItems.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {screenshotItems.map((img, i) => {
                        const globalIdx = coverItem ? i + 1 : i;
                        return (
                            <div
                                key={i}
                                className="relative aspect-video rounded-lg overflow-hidden border hover:border-[#3388BB] transition-colors cursor-zoom-in group border-brand-border-subtle"
                                onClick={() => open(globalIdx)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter") open(globalIdx); }}
                                aria-label={`查看截图 ${i + 1} 大图`}
                            >
                                <SafeImage
                                    src={img.src}
                                    alt={img.alt}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    🔍 查看大图
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── 灯箱弹窗（支持缩放+拖拽，Portal 到 body 避免被 Navbar z-50 遮挡） ── */}
            {lightbox && mounted && createPortal(
                <div
                    ref={overlayRef}
                    className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in ${isZoomed ? "cursor-grab" : "cursor-default"}`}
                    onWheel={onWheel}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onClick={(e) => {
                        if (!isZoomed && e.target === overlayRef.current) close();
                    }}
                >
                    {/* 顶部工具栏 */}
                    <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
                        <div className="text-white/80 text-sm">
                            {lightbox.index + 1} / {allImages.length}
                            {isZoomed && (
                                <span className="ml-3 text-white/60 text-xs">
                                    {Math.round(transform.scale * 100)}% · 双击重置 · 滚轮缩放
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* 缩小 */}
                            <button
                                onClick={() => setTransform(t => {
                                    const ns = Math.max(MIN_SCALE, t.scale - 0.5);
                                    return ns === MIN_SCALE ? {scale: 1, x: 0, y: 0} : {...t, scale: ns};
                                })}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                                aria-label="缩小"
                                title="缩小 (−)"
                            >−</button>
                            {/* 重置 */}
                            <button
                                onClick={resetTransform}
                                className="px-3 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center transition-colors"
                                aria-label="重置缩放"
                                title="重置 (双击)"
                            >{Math.round(transform.scale * 100)}%</button>
                            {/* 放大 */}
                            <button
                                onClick={() => setTransform(t => ({...t, scale: Math.min(MAX_SCALE, t.scale + 0.5)}))}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                                aria-label="放大"
                                title="放大 (+)"
                            >+</button>
                            {/* 关闭 */}
                            <button
                                onClick={close}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition-colors ml-2"
                                aria-label="关闭"
                            >✕</button>
                        </div>
                    </div>

                    {/* 上一张 */}
                    {allImages.length > 1 && !isZoomed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
                            aria-label="上一张"
                        >‹</button>
                    )}

                    {/* 图片容器 */}
                    <div
                        className={`relative flex items-center justify-center w-[90vw] h-[85vh] ${isZoomed ? "overflow-visible" : "overflow-hidden"}`}
                    >
                        <img
                            ref={imgRef}
                            src={allImages[lightbox.index].src}
                            alt={allImages[lightbox.index].alt}
                            key={lightbox.index}
                            className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-fade-in select-none origin-center transition-transform duration-150 ${isZoomed ? "cursor-grab" : "cursor-default"}`}
                            style={{
                                "--scale": transform.scale,
                                "--tx": transform.x / transform.scale,
                                "--ty": transform.y / transform.scale,
                                transform: "scale(var(--scale)) translate(calc(var(--tx) * 1px), calc(var(--ty) * 1px))",
                            } as React.CSSProperties}
                            onMouseDown={onMouseDown}
                            onDoubleClick={onDblClick}
                            draggable={false}
                        />
                    </div>

                    {/* 下一张 */}
                    {allImages.length > 1 && !isZoomed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
                            aria-label="下一张"
                        >›</button>
                    )}

                    {/* 底部提示 */}
                    {!isZoomed && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
                            滚轮或捏合缩放 · 拖拽移动 · 双击重置
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
