/**
 * 作品库列表页加载骨架屏
 */
export default function WorksLoading() {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-28 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-100 rounded mt-2" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 侧边栏骨架 */}
        <aside className="lg:w-56 shrink-0">
          <div className="space-y-6">
            <div>
              <div className="h-4 w-10 bg-gray-200 rounded mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-8 w-full bg-gray-100 rounded" />
                ))}
              </div>
            </div>
            <div>
              <div className="h-4 w-10 bg-gray-200 rounded mb-3" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-6 w-16 bg-gray-100 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 卡片网格骨架 */}
        <div className="flex-1">
          <div className="h-11 w-full bg-gray-100 rounded-lg mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-2/3 bg-gray-100 rounded" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-5 w-12 bg-gray-100 rounded-full" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
