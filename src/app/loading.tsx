export default function HomeLoading() {
  return (
    <div className="animate-pulse space-y-12">
      {/* Hero skeleton */}
      <section className="py-20 md:py-28 text-center">
        <div className="mx-auto mb-6 w-24 h-24 rounded-xl bg-gray-200" />
        <div className="mx-auto mb-4 w-48 h-8 rounded bg-gray-200" />
        <div className="mx-auto mb-3 w-64 h-5 rounded bg-gray-200" />
        <div className="mx-auto mb-8 w-96 h-4 rounded bg-gray-200" />
        <div className="flex justify-center gap-4">
          <div className="w-28 h-10 rounded-lg bg-gray-200" />
          <div className="w-28 h-10 rounded-lg bg-gray-200" />
        </div>
      </section>

      {/* Stats skeleton */}
      <section className="py-10 border-y" style={{ borderColor: "#D0DEE8" }}>
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="text-center space-y-2">
              <div className="mx-auto w-16 h-7 rounded bg-gray-200" />
              <div className="mx-auto w-20 h-4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </section>

      {/* Featured projects skeleton */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="w-32 h-7 rounded bg-gray-200" />
          <div className="w-20 h-5 rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
              <div className="aspect-video bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="w-3/4 h-5 rounded bg-gray-200" />
                <div className="w-full h-4 rounded bg-gray-200" />
                <div className="w-2/3 h-4 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
