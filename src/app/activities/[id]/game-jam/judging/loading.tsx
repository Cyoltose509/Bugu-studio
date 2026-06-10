/**
 * 评审页面 - 加载中
 */
export default function JudgingLoading() {
  return (
    <div className="min-h-screen" style={{ background: "#F8FAFB" }}>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* 标题骨架 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full" style={{ background: "#E6F0F8" }} />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 rounded" style={{ background: "#E6F0F8" }} />
            <div className="h-4 w-32 rounded" style={{ background: "#E6F0F8" }} />
          </div>
        </div>

        {/* 参赛作品列表骨架 */}
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl p-6 border" style={{ background: "#fff", borderColor: "#D0DEE8" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg" style={{ background: "#E6F0F8" }} />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-48 rounded" style={{ background: "#E6F0F8" }} />
                <div className="h-4 w-32 rounded" style={{ background: "#E6F0F8" }} />
              </div>
              <div className="w-20 h-8 rounded-lg" style={{ background: "#E6F0F8" }} />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded" style={{ background: "#E6F0F8" }} />
              <div className="h-3 w-3/4 rounded" style={{ background: "#E6F0F8" }} />
            </div>
          </div>
        ))}
      </div>

      {/* 全局 Loading 遮罩 */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" style={{ color: "#3388BB" }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "#555" }}>加载中…</span>
        </div>
      </div>
    </div>
  );
}
