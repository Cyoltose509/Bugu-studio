/**
 * 管理后台 - 站点设置 - 加载骨架屏
 */
export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 rounded" style={{ background: "#E0E7EE" }} />

      {/* 站点信息卡片骨架 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-xl border p-4" style={{ borderColor: "#D0DEE8" }}>
            <div className="h-4 w-16 rounded mb-2" style={{ background: "#E0E7EE" }} />
            <div className="h-6 w-32 rounded" style={{ background: "#E0E7EE" }} />
          </div>
        ))}
      </div>

      {/* 数据统计骨架 */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#D0DEE8" }}>
        <div className="h-6 w-24 rounded mb-4" style={{ background: "#E0E7EE" }} />
        <div className="grid grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="text-center space-y-2">
              <div className="h-10 w-16 rounded mx-auto" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-12 rounded mx-auto" style={{ background: "#E0E7EE" }} />
            </div>
          ))}
        </div>
      </div>

      {/* 自定义配置骨架 */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        <div className="p-4 border-b" style={{ borderColor: "#D0DEE8" }}>
          <div className="h-6 w-24 rounded" style={{ background: "#E0E7EE" }} />
        </div>
        <div className="p-4 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-32 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 flex-1 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-24 rounded" style={{ background: "#E0E7EE" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
