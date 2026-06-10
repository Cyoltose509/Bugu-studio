"use client";

import Image from "next/image";

/** 作品卡片骨架屏 — 加载中占位 */
export default function WorkCardSkeleton() {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden border shadow-sm animate-pulse"
      style={{ borderColor: "#D0DEE8" }}
    >
      {/* 封面骨架 */}
      <div className="aspect-video" style={{ background: "#E6F0F8" }}>
        <div className="w-full h-full flex items-center justify-center">
          <Image src="/images/logo.png" alt="" width={36} height={36} className="opacity-20" />
        </div>
      </div>
      {/* 内容骨架 */}
      <div className="p-4 space-y-2.5">
        <div className="h-4 w-3/4 rounded" style={{ background: "#E8F0F8" }} />
        <div className="h-3 w-full rounded" style={{ background: "#E8F0F8" }} />
        <div className="h-3 w-1/2 rounded" style={{ background: "#E8F0F8" }} />
        <div className="flex gap-1.5 mt-3">
          <div className="h-5 w-12 rounded" style={{ background: "#E8F0F8" }} />
          <div className="h-5 w-16 rounded" style={{ background: "#E8F0F8" }} />
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="h-3 w-8 rounded" style={{ background: "#E8F0F8" }} />
          <div className="flex -space-x-1">
            <div className="w-5 h-5 rounded-full" style={{ background: "#D0DEE8" }} />
            <div className="w-5 h-5 rounded-full" style={{ background: "#D0DEE8" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
