/**
 * 管理后台布局 - 侧边导航 + 内容区
 */
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

const AdminSidebar = dynamic(() => import("@/components/admin/AdminSidebar"), {
  loading: () => (
    <div className="w-14 lg:w-56 shrink-0 animate-pulse bg-[#1A3A54]" />
  ),
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={session.user.email!} />

      {/* 主内容 — pt-14 用于避免移动端顶部导航遮挡 */}
      <div className="flex-1 overflow-auto bg-brand-surface-page">
        <div className="p-4 lg:p-6 pt-16 lg:pt-6">{children}</div>
      </div>
    </div>
  );
}
