import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4" role="alert">
      <h2 className="text-6xl font-bold text-brand-text-muted mb-4">404</h2>
      <p className="text-xl font-semibold text-brand-text-heading mb-2">页面未找到</p>
      <p className="text-brand-text-secondary mb-8 text-center max-w-md">
        您访问的页面不存在或已被移除。
      </p>
      <Link
        href="/"
        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
      >
        返回首页
      </Link>
    </div>
  );
}
