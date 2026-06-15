"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/works", label: "作品库", icon: "🎮" },
  { href: "/members", label: "成员", icon: "👥" },
  { href: "/activities", label: "活动", icon: "📅" },
  { href: "/history", label: "历史", icon: "📜" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  // 页面切换自动关闭
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 打开时锁定 body 滚动
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const hamburger = (
    <button
      onClick={() => setOpen(!open)}
      className="md:hidden relative w-9 h-9 flex items-center justify-center rounded-lg text-white/85 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all duration-200"
      aria-label={open ? "关闭菜单" : "打开菜单"}
      aria-expanded={open}
    >
      {/* 汉堡三横线 → X 动画 */}
      <span className="relative w-[18px] h-[14px]">
        <span
          className={`absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-300 origin-center ${
            open ? "top-1.5 rotate-45" : "top-0"
          }`}
        />
        <span
          className={`absolute left-0 top-1.5 h-[2px] w-full rounded-full bg-current transition-all duration-300 ${
            open ? "opacity-0 -translate-x-2" : "opacity-100 translate-x-0"
          }`}
        />
        <span
          className={`absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-300 origin-center ${
            open ? "top-1.5 -rotate-45" : "top-3"
          }`}
        />
      </span>
    </button>
  );

  const overlay = (
    <div
      className={`md:hidden fixed inset-0 z-[55] transition-all duration-300 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="导航菜单"
    >
      {/* 遮罩 — 半透明 + 毛玻璃 */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 菜单面板 — 从左侧滑入 */}
      <nav
        className={`absolute top-0 left-0 w-72 h-full flex flex-col shadow-2xl transition-transform duration-300 ease-out
          bg-[#1a3a52] dark:bg-[#121a26]
          border-r border-white/[0.06]
          ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="主导航"
      >
        {/* 顶部：Logo + 品牌标识 */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <Image
            src="/images/logo.png"
            alt="布谷工作室"
            width={36}
            height={36}
            className="rounded-lg shadow-md"
          />
          <div>
            <div className="text-white font-bold text-lg leading-tight">布谷工作室</div>
            <div className="text-white/50 text-xs tracking-wide">BUGU STUDIO</div>
          </div>
        </div>

        {/* 导航链接 */}
        <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brand-orange/15 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-orange" />
                )}
              </Link>
            );
          })}
        </div>

        {/* 底部：版权/提示 */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="text-white/30 text-xs">
            点击遮罩或按 ESC 关闭菜单
          </p>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* 汉堡按钮始终在 Navbar 中（不 Portal），靠右侧 flex 自然排列 */}
      {hamburger}

      {/* 遮罩 + 菜单面板 Portal 到 body，避免层叠上下文问题 */}
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}
