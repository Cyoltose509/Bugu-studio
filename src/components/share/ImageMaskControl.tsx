"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { shareImageMask } from "@/lib/share";

type Stop = "maskZero" | "maskFull";

export default function ImageMaskControl({ zero, full, onChange, en }: {
  zero: number;
  full: number;
  onChange: (stop: Stop, value: number) => void;
  en: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLButtonElement>, stop: Stop) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onChange(stop, Math.max(0, Math.min(100, Math.round((event.clientX - rect.left) / rect.width * 100))));
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, stop: Stop, value: number) => {
    const step = event.shiftKey ? 10 : 1;
    const next = event.key === "ArrowLeft" || event.key === "ArrowDown" ? value - step
      : event.key === "ArrowRight" || event.key === "ArrowUp" ? value + step
      : event.key === "Home" ? 0 : event.key === "End" ? 100 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(stop, Math.max(0, Math.min(100, next)));
  };
  return <div>
    <span className="sr-only">{en ? "Opacity mask gradient" : "遮罩渐变映射"}</span>
    <div ref={trackRef} className="relative mx-3 mb-6 h-2 rounded-full border border-white/50" style={{ touchAction: "none" }}>
      <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "repeating-conic-gradient(#e8edf1 0% 25%, #a5b2bc 0% 50%) 0 0 / 8px 8px" }} aria-hidden />
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[#25547A]" style={{ WebkitMaskImage: shareImageMask(zero, full), maskImage: shareImageMask(zero, full) }} aria-hidden />
      {([ ["maskZero", zero], ["maskFull", full] ] as const).map(([stop, value]) => <button
        key={stop}
        type="button"
        role="slider"
        aria-label={stop === "maskZero" ? (en ? "0% opacity position" : "0% 不透明度位置") : (en ? "100% opacity position" : "100% 不透明度位置")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`x ${value}%`}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); move(event, stop); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event, stop); }}
        onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}
        onKeyDown={event => keyDown(event, stop, value)}
        className={`absolute top-full z-10 -ml-3 mt-0.5 flex h-6 w-6 cursor-ew-resize flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${stop === "maskZero" ? "text-[#E38043]" : "text-white"}`}
        style={{ left: `${value}%`, touchAction: "none" }}
      ><span className="block h-2.5 w-3.5 bg-current" style={{ clipPath: "polygon(50% 0, 0 100%, 100% 100%)" }} aria-hidden /><span className="text-[10px] leading-3" aria-hidden>{stop === "maskZero" ? "x0" : "x1"}</span></button>)}
    </div>
  </div>;
}
