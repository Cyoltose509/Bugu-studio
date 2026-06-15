import WorkCardSkeleton from "@/components/works/WorkCardSkeleton";

export default function WorksLoading() {
  return (
    <>
      {/* 左侧筛选栏骨架 — 纯占位，无 logo/spinner */}
      <aside className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-24 space-y-4">
          {/* 搜索框骨架 */}
          <div className="h-10 rounded-lg bg-brand-surface animate-pulse" />
          {/* 类型筛选骨架 */}
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-brand-surface animate-pulse" />
            <div className="h-8 w-full rounded bg-brand-surface animate-pulse" />
            <div className="h-8 w-full rounded bg-brand-surface animate-pulse" />
            <div className="h-8 w-full rounded bg-brand-surface animate-pulse" />
          </div>
          {/* 标签骨架 */}
          <div className="space-y-2">
            <div className="h-4 w-12 rounded bg-brand-surface animate-pulse" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-6 w-14 rounded-full bg-brand-surface animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* 右侧作品区骨架 */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
