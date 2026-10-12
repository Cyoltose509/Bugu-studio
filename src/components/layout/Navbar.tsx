/**
 * 导航栏 - 深蓝 #25547A + 白色文字
 * 保持为 Server Component，用户会话直接在服务端获取
 *
 * 布局用三栏 grid，避免 absolute 居中与右侧控件重叠。
 */
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth/auth";
import NotificationBell from "./NotificationBell";
import NavLink from "./NavLink";
import ThemeToggle from "./ThemeToggle";
import LangToggle from "./LangToggle";
import NavActionsMenu from "./NavActionsMenu";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export async function Navbar({ lang = "cn" }: { lang?: Lang }) {
  const session = await auth();
  const role = session?.user?.role;
  const canSubmit = role === "MEMBER" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  return (
    <header className="sticky top-0 z-50 shadow-md bg-[#25547A]/90 dark:bg-[#141822]/95 backdrop-blur-sm">
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        {/* Logo — 窄屏只留图标 */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:opacity-85 transition-opacity nav-link shrink-0 min-w-0">
          <Image src="/images/logo.png" alt="BUGOO STUDIO" width={32} height={32} className="rounded shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">{t(lang, "brand.name")}</span>
        </Link>

        {/* 主导航 — 占中间栏，可横向轻滚，不与两侧重叠 */}
        <nav
          className="flex items-center justify-center gap-2 sm:gap-3 md:gap-6 text-[12px] sm:text-sm md:text-base min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="主导航"
        >
          <NavLink href="/works">{t(lang, "nav.works")}</NavLink>
          <NavLink href="/members">{t(lang, "nav.members")}</NavLink>
          <NavLink href="/activities">{t(lang, "nav.activities")}</NavLink>
          <NavLink href="/history">{t(lang, "nav.history")}</NavLink>
        </nav>

        {/* 用户区域 */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-3 shrink-0">
          <LangToggle />
          <ThemeToggle />
          <NavActionsMenu
            canSubmit={canSubmit}
            isAdmin={isAdmin}
            isLoggedIn={!!session?.user}
          />
          {session?.user ? (
            <>
              {canSubmit && (
                <Link href="/submit" className="hidden md:inline-flex text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link whitespace-nowrap">
                  {t(lang, "nav.submit")}
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="hidden md:inline-flex text-sm text-white/80 hover:text-white transition-colors nav-link whitespace-nowrap">
                  {t(lang, "nav.admin")}
                </Link>
              )}
              <NotificationBell />
              <Link href="/profile" className="flex items-center text-sm text-white/80 hover:text-white nav-link shrink-0">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || ""}
                    width={28}
                    height={28}
                    className="rounded-full object-cover border border-white/30"
                    referrerPolicy="no-referrer"
                    sizes="28px"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-brand-orange">
                    {session.user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </Link>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/auth/login" className="text-sm text-white/80 hover:text-white transition-colors nav-link">{t(lang, "nav.login")}</Link>
              <Link href="/auth/register" className="text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">{t(lang, "nav.register")}</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
