/**
 * 管理后台布局 - 侧边导航 + 内容区
 *
 * 后台是独立的整屏应用外壳：占满 100dvh，只有右侧内容区内部滚动，
 * 站点顶部导航与底栏在 /admin 下由 globals.css 的 :has([data-admin-shell]) 规则隐藏。
 */
import dynamic from "next/dynamic";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

const AdminSidebar = dynamic(() => import("@/components/admin/AdminSidebar"), {
  loading: () => (
    <div className="w-14 lg:w-56 shrink-0 h-full animate-pulse bg-[#1A3A54]" />
  ),
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  return (
    <div data-admin-shell="true" className="flex h-dvh overflow-hidden">
      <AdminSidebar userEmail={session.user.email!} />

      {/* 主内容 — 唯一的滚动容器；pt-16 让开移动端左上角汉堡按钮 */}
      <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain bg-brand-surface-page">
        <div className="p-4 lg:p-6 pt-16 lg:pt-6">{children}</div>
      </div>
    </div>
  );
}
