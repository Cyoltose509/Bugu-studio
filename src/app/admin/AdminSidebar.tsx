"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "仪表盘", icon: "📊" },
  { href: "/admin/projects", label: "作品管理", icon: "🎮" },
  { href: "/admin/members", label: "成员管理", icon: "👥" },
  { href: "/admin/users", label: "用户管理", icon: "🔑" },
  { href: "/admin/invites", label: "邀请码", icon: "🎫" },
  { href: "/admin/history-events", label: "历史事件", icon: "📅" },
  { href: "/admin/settings", label: "站点设置", icon: "⚙️" },
  { href: "/admin/audit-logs", label: "审计日志", icon: "📋" },
  { href: "/", label: "返回前台", icon: "🏠" },
];

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 切换页面时自动关闭侧栏
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC 关闭
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center rounded-lg shadow-md text-white"
        style={{ background: "#25547A" }}
        onClick={() => setOpen(!open)}
        aria-label="菜单"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* 遮罩层 */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`w-56 shrink-0 text-white flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "#25547A" }}
      >
        <div className="p-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="" width={28} height={28} className="rounded" />
            <span className="font-bold">管理后台</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/50">当前登录</div>
          <div className="text-sm text-white/80 truncate">{userEmail}</div>
        </div>
      </aside>

      {/* 移动端左侧占位 */}
      <div className="lg:hidden w-0 shrink-0" />
    </>
  );
}
