/**
 * 首页 - 布谷工作室
 * 使用 Suspense 拆分：统计数据立即显示，作品列表流式加载
 */
import {Suspense} from "react";
import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
import HomeStats from "@/components/home/HomeStats";
import LatestProjects from "@/components/home/LatestProjects";
import HomeActivities from "@/components/home/HomeActivities";
import LogoLoading from "@/components/ui/LogoLoading";
import {getLang} from "@/lib/i18n/getLang";
import {t} from "@/lib/i18n/dict";

/** 寒蝉半圆体 — Hero 子集（「布谷工作室」+ official）。
 *  注意：这是字形子集字体，只覆盖这几个字。英文模式下标题是
 *  「Bugoo Studio」，大量字形缺失会导致逐字符回退、字体五花八门，
 *  因此只在中文模式使用，英文模式走全局 Nunito（font-sans）。 */
const chillRoundBold = localFont({
    src: "../fonts/ChillRoundM-hero.woff2",
    weight: "700",
    display: "swap",
    preload: true,
    fallback: ["system-ui", "sans-serif"],
});

export async function generateMetadata() {
    const lang = await getLang();
    return { title: t(lang, "brand.name") };
}

export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

export default async function HomePage() {
    const lang = await getLang();
    return (
        <div className="animate-fade-in">
            {/* Hero */}
            <section className="relative overflow-hidden px-4 py-20 md:py-28 text-center hero-gradient">
                <div className="container mx-auto max-w-3xl relative">
                    <Image src="/images/logo.png" alt={t(lang, "brand.name")} width={96} height={96} className="mx-auto mb-6 rounded-xl shadow-lg"
                           priority/>
                    <h1
                        className={`${lang === "cn" ? chillRoundBold.className : ""} text-4xl md:text-6xl font-bold mb-4 tracking-wide text-brand-navy`}
                    >
                        {t(lang, "brand.name")}
                    </h1>
                    <p
                        className={`${lang === "cn" ? chillRoundBold.className : ""} text-2xl md:text-3xl font-bold mb-3 tracking-wide text-brand-text-body`}
                    >
                        official
                    </p>
                    <p className="mb-8 max-w-xl mx-auto text-brand-text-secondary">
                        {t(lang, "home.intro")}
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/works" className="btn-primary px-6 py-3 rounded-lg font-medium text-sm">{t(lang, "home.browseWorks")}</Link>
                        <Link href="/members" className="btn-secondary px-6 py-3 rounded-lg font-medium text-sm">{t(lang, "home.meetMembers")}</Link>
                    </div>
                </div>
            </section>

            {/* 统计数据 — 直接加载（快） */}
            <Suspense fallback={<StatsSkeleton/>}>
                <HomeStats lang={lang}/>
            </Suspense>

            {/* 最新作品 — 流式加载（8 个 = 桌面 4 列两整行） */}
            <section className="py-16 container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-brand-navy">{t(lang, "home.latestWorks")}</h2>
                    <Link href="/works" className="text-sm hover:underline text-brand-blue">{t(lang, "home.viewAll")} →</Link>
                </div>
                <Suspense fallback={<LogoLoading text={t(lang, "loading.latestWorks")} compact />}>
                    <LatestProjects lang={lang}/>
                </Suspense>
            </section>

            {/* 近期活动 */}
            <Suspense fallback={<div className="py-10 text-center text-gray-400 text-sm">{t(lang, "loading.activities")}</div>}>
                <HomeActivities lang={lang}/>
            </Suspense>

            {/* CTA */}
            <section className="py-16 text-center">
                <div className="container mx-auto px-4 max-w-xl">
                    <h2 className="text-2xl font-bold mb-3 text-brand-navy">{t(lang, "home.joinTitle")}</h2>
                    <p className="mb-6 text-brand-text-secondary">{t(lang, "home.joinDesc")}</p>
                    <Link href="/join" className="btn-primary inline-block px-8 py-3 rounded-lg font-medium text-sm">{t(lang, "home.joinCta")}</Link>
                </div>
            </section>
        </div>
    );
}

/* ── 骨架屏 ────────────────────────────────── */

function StatsSkeleton() {
    return (
        <div className="py-10 border-y animate-pulse border-brand-border-subtle">
            <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                        <div className="mx-auto w-16 h-7 rounded bg-gray-200"/>
                        <div className="mx-auto w-20 h-4 rounded bg-gray-200"/>
                    </div>
                ))}
            </div>
        </div>
    );
}
