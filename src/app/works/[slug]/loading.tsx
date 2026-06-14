export default function WorkDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      {/* 面包屑骨架 */}
      <nav className="text-sm mb-6">
        <span className="inline-block w-8 h-3 bg-brand-surface rounded animate-pulse" />
        <span className="mx-2 text-brand-text-muted">/</span>
        <span className="inline-block w-12 h-3 bg-brand-surface rounded animate-pulse" />
        <span className="mx-2 text-brand-text-muted">/</span>
        <span className="inline-block w-32 h-3 bg-brand-surface rounded animate-pulse" />
      </nav>

      {/* 内容区域骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video rounded-xl bg-brand-surface animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 w-48 bg-brand-surface rounded animate-pulse" />
            <div className="h-5 w-64 bg-brand-surface rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-brand-surface rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-brand-surface rounded animate-pulse" />
          </div>
        </div>
        <aside className="space-y-4">
          <div className="h-32 bg-brand-surface rounded-xl animate-pulse" />
          <div className="h-40 bg-brand-surface rounded-xl animate-pulse" />
        </aside>
      </div>
    </div>
  );
}
