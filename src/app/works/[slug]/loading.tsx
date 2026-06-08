/**
 * 作品详情页加载骨架屏
 * 立即渲染视觉结构，避免 FCP 等待 DB 查询
 */
export default function WorkDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      {/* 面包屑 */}
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主内容骨架 */}
        <div className="lg:col-span-2">
          {/* 封面图骨架 */}
          <div className="aspect-video w-full rounded-xl bg-gray-200 mb-6" />

          {/* 标题骨架 */}
          <div className="h-8 w-3/4 bg-gray-200 rounded mb-2" />
          <div className="h-5 w-1/2 bg-gray-200 rounded mb-6" />

          {/* 标签骨架 */}
          <div className="flex gap-2 mb-6">
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
            <div className="h-6 w-14 bg-gray-200 rounded-full" />
          </div>

          {/* 简介骨架 */}
          <div className="space-y-2 mb-8">
            <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-5/6 bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
            <div className="h-4 w-2/3 bg-gray-100 rounded" />
          </div>

          {/* 截图骨架 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-video rounded-lg bg-gray-200" />
            <div className="aspect-video rounded-lg bg-gray-200" />
          </div>
        </div>

        {/* 右侧信息栏骨架 */}
        <aside className="space-y-6">
          <div className="rounded-xl p-5 border border-gray-200 bg-gray-50">
            <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-10 w-full bg-gray-100 rounded-lg" />
              <div className="h-10 w-full bg-gray-100 rounded-lg" />
            </div>
          </div>

          <div className="rounded-xl p-5 border border-gray-200 bg-gray-50">
            <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
            <div className="space-y-2.5">
              <div className="flex justify-between"><div className="h-4 w-12 bg-gray-100 rounded" /><div className="h-4 w-16 bg-gray-100 rounded" /></div>
              <div className="flex justify-between"><div className="h-4 w-16 bg-gray-100 rounded" /><div className="h-4 w-10 bg-gray-100 rounded" /></div>
            </div>
          </div>

          <div className="rounded-xl p-5 border border-gray-200 bg-gray-50">
            <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                  <div>
                    <div className="h-4 w-20 bg-gray-100 rounded" />
                    <div className="h-3 w-12 bg-gray-100 rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
