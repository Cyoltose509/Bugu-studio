export default function AuditLogsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-8 w-24 rounded-lg" style={{ background: "#E0E7EE" }} />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
            <div className="h-3 w-12 rounded mb-2" style={{ background: "#E0E7EE" }} />
            <div className="h-7 w-16 rounded" style={{ background: "#E0E7EE" }} />
          </div>
        ))}
      </div>

      {/* 筛选栏骨架 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3" style={{ borderColor: "#D0DEE8" }}>
        <div className="h-3 w-16 rounded" style={{ background: "#E0E7EE" }} />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-7 w-14 rounded-lg" style={{ background: "#E0E7EE" }} />
          ))}
        </div>
      </div>

      {/* 表格骨架 */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        <div className="p-8 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-full rounded" style={{ background: "#E0E7EE" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
