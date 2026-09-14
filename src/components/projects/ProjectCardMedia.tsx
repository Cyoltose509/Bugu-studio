"use client";

/**
 * 作品卡片封面区：悬停一段时间后轮播封面 + 详细截图
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectCoverImage from "./ProjectCoverImage";

const HOVER_DELAY_MS = 480;
const SLIDE_INTERVAL_MS = 1300;
const MAX_SLIDES = 5;

export type CardGalleryImage = { url: string; altText?: string | null };

function buildSlides(
  coverImage: string | null | undefined,
  images: CardGalleryImage[] | undefined,
): string[] {
  const out: string[] = [];
  const push = (url?: string | null) => {
    if (!url) return;
    if (!out.includes(url)) out.push(url);
  };
  push(coverImage);
  for (const img of images ?? []) push(img.url);
  return out.slice(0, MAX_SLIDES);
}

export default function ProjectCardMedia({
  coverImage,
  images,
  title,
  priority = false,
  hovering,
}: {
  coverImage: string | null | undefined;
  images?: CardGalleryImage[];
  title: string;
  priority?: boolean;
  /** 由卡片外层传入：鼠标是否悬停在整张卡上 */
  hovering: boolean;
}) {
  const slides = useMemo(
    () => buildSlides(coverImage, images),
    [coverImage, images],
  );
  const canCarousel = slides.length > 1;

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const stop = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setPlaying(false);
    setIndex(0);
  }, []);

  const start = useCallback(() => {
    if (!canCarousel || reduceMotionRef.current) return;

    // 预加载其余图，轮播时少闪
    slides.slice(1).forEach((src) => {
      const img = new window.Image();
      img.decoding = "async";
      img.src = src;
    });

    delayRef.current = setTimeout(() => {
      setPlaying(true);
      setIndex((i) => (i + 1) % slides.length);
      tickRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % slides.length);
      }, SLIDE_INTERVAL_MS);
    }, HOVER_DELAY_MS);
  }, [canCarousel, slides]);

  useEffect(() => {
    if (hovering) start();
    else stop();
    return stop;
  }, [hovering, start, stop]);

  // 只有封面：沿用原封面组件
  if (slides.length <= 1) {
    return (
      <div className="relative aspect-video bg-brand-surface shrink-0 overflow-hidden">
        <ProjectCoverImage
          src={coverImage ?? null}
          alt={title}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-brand-surface shrink-0 overflow-hidden">
      {slides.map((src, i) => {
        const visible = i === index;
        const isRemote = src.startsWith("http");
        return (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-500 ease-out ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!visible}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={visible ? title : ""}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
                playing ? "scale-105" : "scale-100 group-hover:scale-105"
              }`}
              loading={i === 0 || priority ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy={isRemote ? "no-referrer" : undefined}
              draggable={false}
            />
          </div>
        );
      })}

      {/* 轮播指示点 */}
      <div
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 transition-opacity duration-300 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        {slides.map((_, i) => (
          <span
            key={i}
            className={`block h-1 rounded-full transition-all duration-300 ${
              i === index ? "w-3 bg-white" : "w-1 bg-white/55"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
