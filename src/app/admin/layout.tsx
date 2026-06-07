/**
 * 管理后台布局 - 侧边导航 + 内容区
 */
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const navItems = [
    { href: "/admin", label: "仪表盘", icon: "📊" },
    { href: "/admin/projects", label: "作品管理", icon: "🎮" },
    { href: "/admin/members", label: "成员管理", icon: "👥" },
    { href: "/admin/users", label: "用户管理", icon: "🔑" },
    { href: "/admin/invites", label: "邀请码", icon: "🎫" },
    { href: "/admin/settings", label: "站点设置", icon: "⚙️" },
    { href: "/", label: "← 返回前台", icon: "🏠" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <aside className="w-56 shrink-0 text-white flex flex-col" style={{ background: "#25547A" }}>
        <div className="p-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="" width={28} height={28} className="rounded" />
            <span className="font-bold">管理后台</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/50">当前登录</div>
          <div className="text-sm text-white/80 truncate">{session.user.email}</div>
        </div>
      </aside>

      {/* 主内容 */}
      <div className="flex-1 overflow-auto" style={{ background: "#F0F5F9" }}>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
