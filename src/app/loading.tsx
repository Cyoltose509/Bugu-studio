/**
 * 首页加载骨架屏
 */
export default function HomeLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero 骨架 */}
      <div className="px-4 py-20 md:py-28 text-center" style={{ background: "linear-gradient(180deg, #E6F0F8 0%, #D0E4F0 100%)" }}>
        <div className="mx-auto max-w-3xl flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-200 rounded-xl mb-6" />
          <div className="h-10 w-64 bg-gray-200 rounded mb-4" />
          <div className="h-6 w-40 bg-gray-100 rounded mb-3" />
          <div className="h-5 w-80 bg-gray-100 rounded mb-8" />
          <div className="flex gap-4">
            <div className="h-11 w-28 bg-gray-200 rounded-lg" />
            <div className="h-11 w-28 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 统计骨架 */}
      <div className="py-10" style={{ background: "rgba(255,255,255,0.6)" }}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-8 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 作品网格骨架 */}
      <div className="py-16 container mx-auto px-4">
        <div className="h-7 w-28 bg-gray-200 rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="aspect-video bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 bg-gray-200 rounded" />
                <div className="h-4 w-full bg-gray-100 rounded" />
                <div className="flex gap-2">
                  <div className="h-4 w-12 bg-gray-100 rounded" />
                  <div className="h-4 w-12 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
