"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/works", label: "作品库" },
  { href: "/members", label: "成员" },
  { href: "/activities", label: "活动" },
  { href: "/history", label: "历史" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

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

  // 点击遮罩关闭
  const onBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setOpen(false);
  }, []);

  return (
    <>
      {/* 汉堡按钮 — 仅移动端显示 */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden flex items-center justify-center w-9 h-9 text-white/80 hover:text-white transition-colors"
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        )}
      </button>

      {/* 遮罩 + 菜单面板 */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={onBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="导航菜单"
        >
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/50" />

          {/* 菜单面板 */}
          <nav
            className="absolute top-0 left-0 w-64 h-full bg-[#1a3f5c] dark:bg-[#1a1d2a] shadow-xl flex flex-col pt-16"
            aria-label="主导航"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-6 py-3.5 text-white/85 hover:text-white hover:bg-white/10 transition-colors text-base font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
