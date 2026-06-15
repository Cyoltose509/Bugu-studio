"use client";

/** 作品卡片骨架屏 — 加载中占位 */
export default function WorkCardSkeleton() {
  return (
    <div
      className="bg-card rounded-xl overflow-hidden border shadow-sm animate-pulse border-brand-border-subtle"
    >
      {/* 封面骨架 */}
      <div className="aspect-video bg-brand-surface" />
      {/* 内容骨架 */}
      <div className="p-4 space-y-2.5">
        <div className="h-4 w-3/4 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        <div className="h-3 w-full rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        <div className="h-3 w-1/2 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        <div className="flex gap-1.5 mt-3">
          <div className="h-5 w-12 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
          <div className="h-5 w-16 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="h-3 w-8 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
          <div className="flex -space-x-1">
            <div className="w-5 h-5 rounded-full bg-[#D0DEE8] dark:bg-[#3a4058]" />
            <div className="w-5 h-5 rounded-full bg-[#D0DEE8] dark:bg-[#3a4058]" />
          </div>
        </div>
      </div>
    </div>
  );
}
