/**
 * 管理后台 - 作品管理 - 加载骨架屏
 */
export default function AdminProjectsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-8 w-24 rounded-lg" style={{ background: "#E0E7EE" }} />
      </div>

      {/* 状态筛选骨架 */}
      <div className="flex gap-2 flex-wrap">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-8 w-16 rounded-lg" style={{ background: "#E0E7EE" }} />
        ))}
      </div>

      {/* 表格骨架 */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        <div className="p-4 space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-16 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-12 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-16 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-8 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-20 rounded" style={{ background: "#E0E7EE" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
