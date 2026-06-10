/**
 * 活动列表页 - 加载中
 */
export default function ActivitiesLoading() {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      {/* 页面标题骨架 */}
      <div className="mb-10">
        <div className="h-8 w-48 rounded mb-2" style={{ background: "#E6F0F8" }} />
        <div className="h-4 w-64 rounded" style={{ background: "#E6F0F8" }} />
      </div>

      {/* Hero 骨架 */}
      <div className="grid lg:grid-cols-5 gap-10 mb-10">
        <div className="lg:col-span-3">
          <div className="rounded-2xl aspect-[16/9] w-full" style={{ background: "#E6F0F8" }} />
        </div>
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-3 h-16" style={{ background: "#F8FAFB" }} />
          ))}
        </div>
      </div>

      {/* 活动档案骨架 */}
      <div className="h-6 w-32 rounded mb-4" style={{ background: "#E6F0F8" }} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl aspect-video" style={{ background: "#E6F0F8" }} />
        ))}
      </div>
    </div>
  );
}
