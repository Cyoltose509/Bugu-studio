/**
 * 活动详情页 - 加载中
 */
export default function ActivityDetailLoading() {
  return (
    <div className="min-h-screen" style={{ background: "#F8FAFB" }}>
      {/* 顶部横幅骨架 */}
      <div className="relative aspect-[3/1] max-h-72 w-full" style={{ background: "#E6F0F8" }} />

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* 标题骨架 */}
        <div className="space-y-2">
          <div className="h-8 w-3/4 rounded" style={{ background: "#E6F0F8" }} />
          <div className="h-4 w-1/2 rounded" style={{ background: "#E6F0F8" }} />
        </div>

        {/* 内容骨架 */}
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl p-6 space-y-3" style={{ background: "#fff" }}>
            <div className="h-4 w-full rounded" style={{ background: "#E6F0F8" }} />
            <div className="h-4 w-5/6 rounded" style={{ background: "#E6F0F8" }} />
            <div className="h-4 w-2/3 rounded" style={{ background: "#E6F0F8" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
