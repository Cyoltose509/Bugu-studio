export default function CourseJudgingLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 w-32 rounded mb-6 bg-brand-surface" />
      <div className="h-7 w-48 rounded mb-2 bg-brand-surface" />
      <div className="h-4 w-64 rounded mb-6 bg-brand-surface" />
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 mb-6">
        <div className="h-5 w-24 rounded mb-4 bg-brand-surface" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-brand-surface" />
          <div className="h-8 w-20 rounded-full bg-brand-surface" />
        </div>
      </div>
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6">
        <div className="h-5 w-32 rounded mb-4 bg-brand-surface" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl mb-3 bg-[#F0F6FA]" />
        ))}
      </div>
    </div>
  );
}
