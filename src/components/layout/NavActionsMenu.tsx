"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  canSubmit?: boolean;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
};

type Item = {
  href: string;
  label: string;
  danger?: boolean;
  primary?: boolean;
};

/** 窄屏功能下拉：提交/后台/登录等，不含主导航 tab */
export default function NavActionsMenu({
  canSubmit = false,
  isAdmin = false,
  isLoggedIn = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const items: Item[] = [];
  if (canSubmit) items.push({ href: "/submit", label: "提交作品", primary: true });
  if (isAdmin) items.push({ href: "/admin", label: "管理后台" });
  if (isLoggedIn) {
    items.push({ href: "/profile", label: "个人中心" });
    items.push({ href: "/auth/signout", label: "退出登录", danger: true });
  } else {
    items.push({ href: "/auth/login", label: "登录" });
    items.push({ href: "/auth/register", label: "注册", primary: true });
  }

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative w-[16px] h-[12px]" aria-hidden>
          <span className={`absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-200 origin-center ${open ? "top-[5px] rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 top-[5px] h-[2px] w-full rounded-full bg-current transition-all duration-200 ${open ? "opacity-0" : "opacity-100"}`} />
          <span className={`absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-200 origin-center ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[60] w-44 rounded-xl border border-white/10 bg-[#1a3a52] dark:bg-[#121a26] shadow-xl py-1.5 overflow-hidden"
        >
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              role="menuitem"
              onClick={close}
              className={`block px-3.5 py-2.5 text-sm font-medium transition-colors ${
                item.danger
                  ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
                  : item.primary
                  ? "text-brand-orange hover:bg-white/[0.06]"
                  : "text-white/85 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
