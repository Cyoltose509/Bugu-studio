/**
 * 个人中心页加载骨架屏
 */
export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-pulse space-y-8">
      {/* 头部骨架 */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="h-7 w-32 bg-gray-200 rounded mx-auto sm:mx-0" />
            <div className="h-4 w-48 bg-gray-100 rounded mx-auto sm:mx-0" />
            <div className="flex gap-2 justify-center sm:justify-start mt-2">
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-5 w-12 bg-gray-100 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 bg-gray-200 rounded-lg" />
            <div className="h-9 w-20 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 账号信息骨架 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="h-5 w-20 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-3 w-12 bg-gray-100 rounded mb-1" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 社团信息骨架 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-3 w-12 bg-gray-100 rounded mb-1" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 作品列表骨架 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="h-5 w-20 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div className="space-y-1">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-3 w-10 bg-gray-100 rounded" />
                  <div className="h-3 w-14 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
