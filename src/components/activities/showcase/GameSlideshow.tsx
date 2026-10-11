"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildShowcaseSlides, type ShowcaseSlideshowProject } from "@/lib/activities/slideshow";
import styles from "./GameSlideshow.module.css";

const SLIDE_DURATION = 6500;

function SlideshowImage({ src, cover, alt, className, thumbnail = false }: {
  src: string; cover: string | null; alt: string; className: string; thumbnail?: boolean;
}) {
  const [fallback, setFallback] = useState(0);
  const resolved = fallback === 0 ? src : fallback === 1 && cover ? cover : "/images/logo.png";
  return <img src={resolved} alt={thumbnail ? "" : alt} className={className}
    loading={thumbnail ? "lazy" : "eager"}
    onError={() => setFallback(stage => Math.min(stage + 1, 2))} />;
}

export default function GameSlideshow({ projects }: { projects: ShowcaseSlideshowProject[] }) {
  const slides = useMemo(() => buildShowcaseSlides(projects), [projects]);
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const ownedFullscreen = useRef(false);
  const currentThumbnail = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const slide = slides[index];

  const step = useCallback((delta: number) => {
    setIndex(i => (i + delta + slides.length) % slides.length);
  }, [slides.length]);

  const close = useCallback(() => {
    setOpen(false);
    setPlaying(false);
    dialog.current?.close();
    if (document.fullscreenElement === player.current) {
      void document.exitFullscreen?.().catch(() => {});
    }
    ownedFullscreen.current = false;
  }, []);

  function start() {
    if (!slides.length || !dialog.current) return;
    setIndex(0);
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setHidden(document.hidden);
    dialog.current.showModal();
    setOpen(true);
    // Request inside the click gesture; unsupported browsers use the same viewport-filling dialog.
    if (player.current?.requestFullscreen) {
      void player.current.requestFullscreen().then(() => {
        if (dialog.current?.open) ownedFullscreen.current = true;
        else if (document.fullscreenElement === player.current) void document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onVisibility = () => setHidden(document.hidden);
    const onFullscreen = () => {
      if (ownedFullscreen.current && document.fullscreenElement !== player.current) close();
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || !playing || hidden || slides.length < 2) return;
    const timer = window.setTimeout(() => step(1), SLIDE_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, playing, hidden, index, slides.length, step]);

  useEffect(() => {
    if (!open) return;
    currentThumbnail.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    // Only preload the next frame, keeping the catalogue cheap to open on mobile.
    const next = slides[(index + 1) % slides.length];
    if (next) {
      const image = new window.Image();
      image.src = next.src;
    }
  }, [open, index, slides]);

  if (!slides.length) return null;
  return <>
    <button type="button" onClick={start} className="btn-primary flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l14-8z" /></svg>
      全屏播放作品
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-label="游戏作品全屏轮播" onClose={close}
      onCancel={e => { e.preventDefault(); close(); }}
      onKeyDown={e => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1);
        } else if (e.key === " " && e.target === dialog.current) {
          e.preventDefault(); setPlaying(p => !p);
        }
      }}>
      <div ref={player} className="relative h-full w-full bg-[#080b10]">
      {open && slide && <>
        <SlideshowImage key={slide.src} src={slide.src} cover={slide.project.coverImage} alt={slide.alt}
          className="absolute inset-0 h-full w-full object-contain" />
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-black/40 px-4 py-3 sm:px-8">
          <p className="text-xs sm:text-sm text-white/80">BUGOO / 作品放映 <span className="ml-3 tabular-nums">{index + 1} / {slides.length}</span></p>
          <button type="button" onClick={close} className={styles.control} aria-label="退出全屏轮播" autoFocus>退出 ×</button>
        </div>
        <div className={`${styles.shade} ${styles.caption} absolute inset-x-0 bottom-0 pt-24`}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium tracking-widest text-white/60">{slide.kind} · {projects.findIndex(p => p.id === slide.project.id) + 1} / {projects.length} 款作品</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => step(-1)} className={styles.control} disabled={slides.length < 2} aria-label="上一张">←</button>
                <button type="button" onClick={() => setPlaying(p => !p)} className={styles.control} disabled={slides.length < 2} aria-label={playing ? "暂停轮播" : "继续播放"}>{playing ? "Ⅱ" : "▶"}</button>
                <button type="button" onClick={() => step(1)} className={styles.control} disabled={slides.length < 2} aria-label="下一张">→</button>
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-bold leading-tight text-white sm:text-4xl">{slide.project.title}</h2>
            <div className="mb-3 flex max-h-20 flex-wrap gap-2 overflow-y-auto" aria-label="作品标签">
              {slide.project.tags.map(tag => <span key={tag.slug} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white">{tag.name}</span>)}
            </div>
            <p className={`${styles.description} max-w-3xl line-clamp-3 text-sm leading-relaxed text-white/85 sm:text-base`}>{slide.project.description || "作品简介待补充，欢迎到现场和创作者交流。"}</p>
            <div className={`${styles.thumbnails} mt-5 flex gap-2 overflow-x-auto pb-1`} aria-label="轮播缩略图">
              {slides.map((item, i) => <button key={`${item.project.id}-${item.src}`} type="button" ref={i === index ? currentThumbnail : undefined}
                aria-label={`查看 ${item.alt}`} aria-current={i === index ? "true" : undefined}
                className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-md border-2 sm:h-14 sm:w-24 ${i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-100"}`}
                onClick={() => { setIndex(i); setPlaying(false); }}>
                <SlideshowImage src={item.src} cover={item.project.coverImage} alt={item.alt} thumbnail className="h-full w-full object-cover" />
              </button>)}
            </div>
          </div>
        </div>
      </>}
      </div>
    </dialog>
  </>;
}
