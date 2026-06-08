/**
 * 成员详情页 - 加载骨架屏
 */
export default function MemberDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      {/* 面包屑骨架 */}
      <div className="flex gap-2 mb-8">
        <div className="h-4 w-8 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-4 w-4 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-4 w-16 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-4 w-4 rounded" style={{ background: "#E0E7EE" }} />
        <div className="h-4 w-20 rounded" style={{ background: "#E0E7EE" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主区域 */}
        <div className="lg:col-span-2 space-y-10">
          {/* 顶部信息卡片骨架 */}
          <div className="flex flex-col sm:flex-row items-start gap-6 p-6 rounded-xl border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <div className="w-24 h-24 rounded-full shrink-0" style={{ background: "#E0E7EE" }} />
            <div className="flex-1 space-y-2">
              <div className="h-8 w-32 rounded" style={{ background: "#E0E7EE" }} />
              <div className="h-4 w-48 rounded" style={{ background: "#E0E7EE" }} />
              <div className="flex gap-2">
                <div className="h-6 w-12 rounded-full" style={{ background: "#E0E7EE" }} />
              </div>
            </div>
          </div>

          {/* 个人简介骨架 */}
          <div className="space-y-2">
            <div className="h-6 w-24 rounded" style={{ background: "#E0E7EE" }} />
            <div className="h-4 w-full rounded" style={{ background: "#E0E7EE" }} />
            <div className="h-4 w-full rounded" style={{ background: "#E0E7EE" }} />
            <div className="h-4 w-3/4 rounded" style={{ background: "#E0E7EE" }} />
          </div>

          {/* 参与项目骨架 */}
          <div className="space-y-4">
            <div className="h-6 w-32 rounded" style={{ background: "#E0E7EE" }} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2].map(i => (
                <div key={i} className="flex gap-4 p-4 rounded-xl border" style={{ borderColor: "#D0DEE8" }}>
                  <div className="w-20 h-14 rounded-lg" style={{ background: "#E0E7EE" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded" style={{ background: "#E0E7EE" }} />
                    <div className="h-3 w-20 rounded" style={{ background: "#E0E7EE" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧边栏骨架 */}
        <aside className="space-y-6">
          <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <div className="h-6 w-20 rounded mb-3" style={{ background: "#E0E7EE" }} />
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 w-full rounded-lg" style={{ background: "#E0E7EE" }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <div className="h-6 w-20 rounded mb-3" style={{ background: "#E0E7EE" }} />
            <div className="space-y-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-16 rounded" style={{ background: "#E0E7EE" }} />
                  <div className="h-4 w-12 rounded" style={{ background: "#E0E7EE" }} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
