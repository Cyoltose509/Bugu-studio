"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { buildShowcaseSlides, type ShowcaseSlideshowProject } from "@/lib/activities/slideshow";
import EngineTagIcon from "@/components/tags/EngineTagIcon";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";
import { tagDisplayName } from "@/lib/tags/tag-names";
import styles from "./GameSlideshow.module.css";

/** 单张停留时长。原来 6.5s 太拖，缩到 3.2s，看目录更像翻片子 */
const SLIDE_DURATION = 3200;

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
  const { lang } = useLang();
  const slides = useMemo(() => buildShowcaseSlides(projects), [projects]);
  const dialog = useRef<HTMLDialogElement>(null);
  const playTrigger = useRef<HTMLButtonElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const ownedFullscreen = useRef(false);
  const currentThumbnail = useRef<HTMLButtonElement>(null);
  const filmstripId = useId();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const currentIndex = slides.length ? index % slides.length : 0;
  const slide = slides[currentIndex];

  const step = useCallback((delta: number) => {
    setIndex(i => slides.length ? (i + delta + slides.length) % slides.length : 0);
  }, [slides.length]);

  const close = useCallback(() => {
    setOpen(false);
    setPlaying(false);
    setGalleryOpen(false);
    dialog.current?.close();
    playTrigger.current?.focus({ preventScroll: true });
    if (player.current && document.fullscreenElement === player.current) {
      void document.exitFullscreen?.().catch(() => {}).finally(() => {
        if (!dialog.current?.open) playTrigger.current?.focus({ preventScroll: true });
      });
    }
    ownedFullscreen.current = false;
  }, []);

  function start() {
    if (!slides.length || !dialog.current) return;
    setIndex(0);
    setGalleryOpen(false);
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setHidden(document.hidden);
    dialog.current.showModal();
    setOpen(true);
    // Request inside the click gesture; unsupported browsers use the same viewport-filling dialog.
    const target = player.current;
    if (target?.requestFullscreen) {
      void target.requestFullscreen().then(() => {
        if (dialog.current?.open && player.current === target) ownedFullscreen.current = true;
        else if (document.fullscreenElement === target) void document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!open) return;
    const fullscreenTarget = player.current;
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
      if (fullscreenTarget && document.fullscreenElement === fullscreenTarget) {
        ownedFullscreen.current = false;
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [open, close]);

  useEffect(() => {
    if (!slides.length && open) close();
    else if (index !== currentIndex) setIndex(currentIndex);
  }, [slides.length, open, index, currentIndex, close]);

  useEffect(() => {
    if (!open || !playing || hidden || slides.length < 2) return;
    const timer = window.setTimeout(() => step(1), SLIDE_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, playing, hidden, index, slides.length, step]);

  useEffect(() => {
    if (!open) return;
    // Only preload the next frame, keeping the catalogue cheap to open on mobile.
    const next = slides[(currentIndex + 1) % slides.length];
    if (next) {
      const image = new window.Image();
      image.src = next.src;
    }
  }, [open, currentIndex, slides]);

  useEffect(() => {
    if (galleryOpen) currentThumbnail.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [galleryOpen, index]);

  if (!slides.length) return null;
  return <>
    <button ref={playTrigger} type="button" onClick={start} className="btn-primary flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l14-8z" /></svg>
      {t(lang, "showcase.slideshow.play")}
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-label={t(lang, "showcase.slideshow.aria")}
      onClose={e => { if (!e.currentTarget.open) close(); }}
      onCancel={e => { e.preventDefault(); close(); }}
      onKeyDown={e => {
        if (e.key === " " && e.target === dialog.current) {
          e.preventDefault(); setPlaying(p => !p);
        }
      }}>
      <div ref={player} className={`relative h-full w-full bg-[#080b10] ${galleryOpen ? styles.galleryExpanded : ""}`}>
      {open && slide && <>
        <SlideshowImage key={`${slide.project.id}-${slide.src}-${slide.project.coverImage}`} src={slide.src} cover={slide.project.coverImage} alt={slide.alt}
          className={`${styles.coverImage} absolute inset-0 h-full w-full`} />
        <div className={styles.header}>
          <p className={styles.brand}>BUGOO STUDIO <span>{t(lang, "showcase.slideshow.brand")}</span></p>
          <button type="button" onClick={close} className={styles.closeButton} aria-label={t(lang, "showcase.slideshow.closeAria")} autoFocus>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.caption}>
          <div className={styles.details}>
            <p className={styles.eyebrow}>{t(lang, "showcase.playable")} <span>{String(projects.findIndex(p => p.id === slide.project.id) + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span></p>
            <h2 className={styles.title}>{slide.project.title}</h2>
            <div className={styles.tags} aria-label={t(lang, "showcase.slideshow.tagsAria")}>
              {slide.project.tags.map(tag => <span key={tag.slug}><EngineTagIcon slug={tag.slug} className={styles.engineIcon} />{tagDisplayName(tag.slug, tag.name, lang)}</span>)}
            </div>
            <p className={styles.description}>{slide.project.description || t(lang, "showcase.noDesc")}</p>
          </div>
          <div className={styles.playback}>
              <p className={styles.frameCount}><span>{String(currentIndex + 1).padStart(2, "0")}</span><span>/ {String(slides.length).padStart(2, "0")} · {slide.kind === "封面" ? t(lang, "showcase.slideshow.kindCover") : t(lang, "showcase.slideshow.kindShot")}</span></p>
              <button type="button" onClick={() => setPlaying(p => !p)} className={styles.playButton} disabled={slides.length < 2} aria-label={playing ? t(lang, "showcase.slideshow.pause") : t(lang, "showcase.slideshow.resume")}>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d={playing ? "M6 4h4v16H6zm8 0h4v16h-4z" : "M7 4v16l14-8z"} /></svg>
              </button>
          </div>
        </div>
        <div className={`${styles.drawer} ${galleryOpen ? styles.drawerOpen : ""}`} aria-label={t(lang, "showcase.slideshow.drawerAria")}
          onPointerEnter={e => { if (e.pointerType === "mouse") setGalleryOpen(true); }}
          onPointerLeave={e => {
            const focused = document.activeElement;
            if (e.pointerType === "mouse" && !(focused && e.currentTarget.contains(focused) && focused.matches(":focus-visible"))) setGalleryOpen(false);
          }}
          onFocusCapture={e => { if (e.target.matches(":focus-visible")) setGalleryOpen(true); }}
          onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setGalleryOpen(false); }}>
            <div id={filmstripId} className={styles.filmstrip} aria-hidden={!galleryOpen} inert={!galleryOpen}>
            <div className={styles.thumbnails} aria-label={t(lang, "showcase.slideshow.thumbsAria")}>
              {slides.map((item, i) => <button key={`${item.project.id}-${item.src}-${item.project.coverImage}`} type="button" ref={i === currentIndex ? currentThumbnail : undefined}
                aria-label={t(lang, "showcase.slideshow.viewAria", { name: item.alt })} aria-current={i === currentIndex ? "true" : undefined}
                className={`${styles.thumbnail} ${i === currentIndex ? styles.thumbnailCurrent : ""}`}
                onClick={() => { setIndex(i); setPlaying(false); }}>
                <SlideshowImage src={item.src} cover={item.project.coverImage} alt={item.alt} thumbnail className="h-full w-full object-cover" />
              </button>)}
            </div>
            </div>
            <button type="button" className={styles.galleryTrigger} aria-label={t(lang, "showcase.slideshow.browseAria")} aria-expanded={galleryOpen} aria-controls={filmstripId}
              onClick={() => setGalleryOpen(value => !value)}>
              <span className={styles.galleryHandle} aria-hidden="true" />
              <span>{galleryOpen ? t(lang, "showcase.slideshow.collapse") : t(lang, "showcase.slideshow.browse")}</span>
            </button>
        </div>
      </>}
      </div>
    </dialog>
  </>;
}
