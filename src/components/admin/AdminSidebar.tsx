"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "仪表盘", icon: "📊" },
  { href: "/admin/projects", label: "作品管理", icon: "🎮" },
  { href: "/admin/members", label: "成员管理", icon: "👥" },
  { href: "/admin/users", label: "用户管理", icon: "🔑" },
  { href: "/admin/invites", label: "邀请码", icon: "🎫" },
  { href: "/admin/activities", label: "活动管理", icon: "📅" },
  { href: "/admin/history-events", label: "历史事件", icon: "📆" },
  { href: "/admin/monitoring", label: "系统管理", icon: "🗄️" },
  { href: "/", label: "返回前台", icon: "🏠" },
];

function SidebarNav({ pathname }: { pathname: string }) {
  return (
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
  );
}

function SidebarContent({ userEmail, pathname }: { userEmail: string; pathname: string }) {
  return (
    <>
      <div className="p-5 border-b border-white/10">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="" width={28} height={28} className="rounded" />
          <span className="font-bold">管理后台</span>
        </Link>
      </div>
      <SidebarNav pathname={pathname} />
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/50">当前登录</div>
        <div className="text-sm text-white/80 truncate">{userEmail}</div>
      </div>
    </>
  );
}

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // 客户端挂载后才 Portal，避免 SSR 报错
  useEffect(() => { setMounted(true); }, []);

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

  const close = () => setOpen(false);

  return (
    <>
      {/* 
        移动端：汉堡按钮 + 遮罩层 + 侧边栏 → Portal 到 body
        绕过根布局 <div className="relative z-[1]"> 创建的层叠上下文，
        确保这些元素位于 Navbar (z-50) 之上
      */}
      {mounted &&
        createPortal(
          <>
            {/* 汉堡按钮 */}
            <button
              className="lg:hidden fixed top-3 left-3 z-[60] w-10 h-10 flex items-center justify-center rounded-lg shadow-md text-white bg-brand-navy"
              onClick={() => setOpen(!open)}
              aria-label="菜单"
            >
              {open ? "✕" : "☰"}
            </button>

            {/* 遮罩层 */}
            {open && (
              <div
                className="lg:hidden fixed inset-0 z-[45] bg-black/50"
                onClick={close}
              />
            )}

            {/* 移动端侧边栏 */}
            <aside
              className={`lg:hidden fixed inset-y-0 left-0 z-[50] w-56 text-white flex flex-col bg-brand-navy dark:bg-[#0f1923] border-r border-white/[0.08] shadow-2xl transition-transform duration-200 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <SidebarContent userEmail={userEmail} pathname={pathname} />
            </aside>
          </>,
          document.body
        )}

      {/* 桌面端侧边栏 — 保持在 flex 布局内，sticky 正常跟随文档流 */}
      <aside className="hidden lg:flex w-56 shrink-0 sticky top-0 h-screen text-white bg-brand-navy flex-col">
        <SidebarContent userEmail={userEmail} pathname={pathname} />
      </aside>

      {/* 移动端左侧占位 */}
      <div className="lg:hidden w-0 shrink-0" />
    </>
  );
}
