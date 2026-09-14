"use client";

/** 作品卡片骨架屏 — 槽位高度与 ProjectCard 对齐，避免加载前后跳动 */
export default function WorkCardSkeleton() {
  return (
    <div className="h-full flex flex-col bg-card rounded-xl overflow-hidden border shadow-sm animate-pulse border-brand-border-subtle">
      <div className="aspect-video bg-brand-surface shrink-0" />
      <div className="flex flex-1 flex-col p-4">
        <div className="h-5 w-3/4 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        <div className="mt-1 h-10 space-y-1">
          <div className="h-4 w-full rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
          <div className="h-4 w-2/3 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        </div>
        <div className="mt-3 h-6 flex items-center gap-1.5">
          <div className="h-5 w-12 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
          <div className="h-5 w-14 rounded bg-[#E8F0F8] dark:bg-[#2a3045]" />
        </div>
        <div className="flex justify-between items-center mt-auto pt-3">
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
