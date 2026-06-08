/**
 * 管理后台布局 - 侧边导航 + 内容区
 */
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={session.user.email!} />

      {/* 主内容 */}
      <div className="flex-1 overflow-auto" style={{ background: "#F0F5F9" }}>
        <div className="p-4 lg:p-6 pt-14 lg:pt-6">{children}</div>
      </div>
    </div>
  );
}
