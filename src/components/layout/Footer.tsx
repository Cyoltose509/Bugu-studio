import Link from "next/link";
import Image from "next/image";

import { getClubFoundedYear } from "@/lib/club";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export function Footer({ lang = "cn" }: { lang?: Lang }) {
    const currentYear = new Date().getFullYear();
    const foundedYear = getClubFoundedYear();

    return (
        <footer className="border-t border-[#D0DEE8] dark:border-[#2a3045] bg-[#F0F5F9] dark:bg-[#141822]">
            <div className="flex-1 relative">
                <div className="absolute inset-0 pointer-events-none texture-bg texture-bg--fade-up" />
                <div className="relative z-[1]">
                    <div className="container mx-auto px-4 py-10">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
                            <div className="col-span-2 md:col-span-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <Image src="/images/logo.png" alt={t(lang, "brand.name")} width={28} height={28} className="rounded"/>
                                    <span className="font-bold text-[#25547A] dark:text-[#7eb8da]">{t(lang, "brand.name")}</span>
                                </div>
                                <p className="text-sm text-[#777] dark:text-[#8899aa]">
                                    {t(lang, "footer.tagline")}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-[#333] dark:text-[#ccd]">{t(lang, "footer.quickLinks")}</h3>
                                <ul className="space-y-2 text-sm text-[#777] dark:text-[#889]">
                                    <li><Link href="/works" className="hover:text-[#3388BB] transition-colors">{t(lang, "nav.works")}</Link></li>
                                    <li><Link href="/members" className="hover:text-[#3388BB] transition-colors">{t(lang, "footer.membersList")}</Link></li>
                                    <li><Link href="/activities" className="hover:text-[#3388BB] transition-colors">{t(lang, "footer.clubActivities")}</Link></li>
                                    <li><Link href="/history" className="hover:text-[#3388BB] transition-colors">{t(lang, "footer.clubHistory")}</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-[#333] dark:text-[#ccd]">{t(lang, "footer.followUs")}</h3>
                                <ul className="space-y-2 text-sm text-[#777] dark:text-[#889]">
                                    <li><a href="https://space.bilibili.com/2074896294" target="_blank" rel="noopener noreferrer"
                                           className="hover:text-[#3388BB] transition-colors">{t(lang, "footer.bilibili")}</a></li>
                                    <li><a href="/join" target="_blank" rel="noopener noreferrer"
                                           className="hover:text-[#3388BB] transition-colors">{t(lang, "footer.recruit")}</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-[#D0DEE8] dark:border-[#2a3045] flex flex-col md:flex-row justify-between items-center gap-3">
                            <p className="text-xs text-[#999] dark:text-[#667]">
                                {"\u00A9"} {foundedYear}–{currentYear} {t(lang, "footer.rights")}
                            </p>
                            <div className="flex gap-4 text-xs text-[#999] dark:text-[#667]">
                                <Link href="/privacy" className="hover:text-[#555]">{t(lang, "footer.privacy")}</Link>
                                <Link href="/terms" className="hover:text-[#555]">{t(lang, "footer.terms")}</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </footer>
    );
}
