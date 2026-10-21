/**
 * Navbar 骨架屏 — layout Suspense fallback
 * 在 auth() 完成前显示，不阻塞首屏渲染
 */
import Link from "next/link";
import Image from "next/image";
import NavLink from "@/components/layout/NavLink";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export function NavbarSkeleton({ lang }: { lang: Lang }) {
  return (
    <header className="sticky top-0 z-50 shadow-md bg-brand-navy/90">
      <div className="container mx-auto px-2.5 sm:px-4 py-2.5 sm:py-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
        <Link href="/" className="nav-logo flex items-center gap-2 font-bold text-lg text-white hover:opacity-85 transition-opacity nav-link shrink-0">
          <span className="nav-logo-flip">
            <span className="nav-logo-flip-inner">
              <span className="nav-logo-flip-face nav-logo-flip-front">
                <Image src="/images/logo.png" alt="BUGOO STUDIO" width={32} height={32} />
              </span>
              <span className="nav-logo-flip-face nav-logo-flip-back" aria-hidden="true">
                HOME
              </span>
            </span>
          </span>
          <span className="hidden md:inline whitespace-nowrap">{t(lang, "brand.name")}</span>
        </Link>
        <nav
          className="hidden md:flex items-center justify-center gap-3 lg:gap-6 text-sm lg:text-base min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={t(lang, "nav.mainAria")}
        >
          <NavLink href="/works">{t(lang, "nav.works")}</NavLink>
          <NavLink href="/members">{t(lang, "nav.members")}</NavLink>
          <NavLink href="/activities">{t(lang, "nav.activities")}</NavLink>
          <NavLink href="/history">{t(lang, "nav.history")}</NavLink>
        </nav>
        <div className="flex items-center justify-end gap-2 shrink-0 min-h-8">
          <Link href="/auth/login" className="hidden md:inline text-sm text-white/80 hover:text-white transition-colors nav-link">{t(lang, "nav.login")}</Link>
          <Link href="/auth/register" className="hidden md:inline-flex text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">{t(lang, "nav.register")}</Link>
        </div>
      </div>
      <nav className="md:hidden border-t border-white/10" aria-label={t(lang, "nav.mainAria")}>
        <div className="container mx-auto px-1 grid grid-cols-4">
          <div className="flex justify-center py-2.5"><NavLink href="/works" className="text-[13px]">{t(lang, "nav.works")}</NavLink></div>
          <div className="flex justify-center py-2.5"><NavLink href="/members" className="text-[13px]">{t(lang, "nav.members")}</NavLink></div>
          <div className="flex justify-center py-2.5"><NavLink href="/activities" className="text-[13px]">{t(lang, "nav.activities")}</NavLink></div>
          <div className="flex justify-center py-2.5"><NavLink href="/history" className="text-[13px]">{t(lang, "nav.history")}</NavLink></div>
        </div>
      </nav>
    </header>
  );
}
