import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus} from "@prisma/client";
import {getLang} from "@/lib/i18n/getLang";
import {t} from "@/lib/i18n/dict";

export async function generateMetadata(): Promise<Metadata> {
    const lang = await getLang();
    return {title: t(lang, "page.join.title"), description: t(lang, "page.join.description")};
}

export const dynamic = "force-dynamic";

export default async function JoinPage() {
    const lang = await getLang();
    const top3 = await cachedQuery("join:top3", () =>
            prisma.project.findMany({
                where: {status: ProjectStatus.PUBLISHED},
                orderBy: {likes: {_count: "desc"}},
                take: 3,
                select: {
                    id: true, slug: true, title: true, coverImage: true,
                    type: true, developYear: true,
                    _count: {select: {likes: true}},
                },
            }),
        300,
    );
    return (
        <div className="animate-fade-in">
            {/* ── Hero / 工作室简介 ── */}
            <section className="relative overflow-hidden px-4 py-20 md:py-28 text-center join-g1">
                <div className="container mx-auto max-w-3xl relative z-10">
                    <Image
                        src="/images/logo.png"
                        alt={t(lang, "brand.name")}
                        width={88}
                        height={88}
                        className="mx-auto mb-6 rounded-xl shadow-lg"
                        priority
                    />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-brand-navy">
                        {t(lang, "join.heroTitle")}
                    </h1>
                    <p className="text-lg mb-2 text-brand-text-body">
                        {t(lang, "join.subtitle")}
                    </p>
                    <p className="max-w-2xl mx-auto leading-relaxed text-brand-text-secondary">
                        {t(lang, "join.heroDesc")}
                    </p>
                </div>
                {/* 背景装饰 */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(51,136,187,0.15)_0%,transparent_70%)]" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[radial-gradient(circle,rgba(227,128,67,0.12)_0%,transparent_70%)]" />
                </div>
            </section>

            {/* ── 加入我们 Q&A ── */}
            <section className="py-20 md:py-10 px-4 text-center join-g2">
                <div className="text-center mb-12">
                    <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                        {t(lang, "join.brandLine")}
                    </p>
                    <h2 className="text-3xl font-bold text-brand-navy">
                        {t(lang, "join.joinUs")}
                    </h2>
                </div>
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* 左侧：QQ 群二维码 (1/4) */}
                    <div className="md:col-span-1 flex flex-col items-center">
                        <div className="rounded-2xl p-6 w-full text-center glass-card">
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt={t(lang, "join.qqCodeAlt")}
                                width={200}
                                height={200}
                                className="mx-auto rounded-lg"
                            />
                            <p className="mt-4 text-sm text-brand-text-muted">
                                {t(lang, "join.scanQQ")}
                            </p>
                            <p className="text-xs mt-1 text-brand-text-muted">{t(lang, "join.moreUpdates")}</p>
                        </div>
                    </div>

                    {/* 右侧：Q&A (3/4) */}
                    <div className="md:col-span-3 space-y-6">
                        {/* Q1 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                {t(lang, "join.q1Title")}
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                {t(lang, "join.q1Desc")}
                            </p>
                        </div>

                        {/* Q3 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                {t(lang, "join.q2Title")}
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                {t(lang, "join.q2Desc")}
                            </p>
                        </div>

                        {/* Q4 — 入会要求 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                {t(lang, "join.q3Title")}
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                {t(lang, "join.q3Desc")}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 新学期活动预告 ── */}
            <section className="py-16 join-g3">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                            {t(lang, "join.brandLine")}
                        </p>
                        <h2 className="text-3xl font-bold text-brand-navy">
                            {t(lang, "join.activities")}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 活动一：例会 */}
                        <div className="rounded-2xl p-8 glass-card">
                            <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                {t(lang, "join.meeting")}
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                {t(lang, "join.meetingDesc")}
                            </p>
                        </div>

                        {/* 活动二：公开课 */}
                        <div className="rounded-2xl p-8 glass-card">
                            <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                {t(lang, "join.course")}
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                {t(lang, "join.courseDesc")}
                            </p>
                        </div>

                        {/* 活动三：Game Jam */}
                        <div className="rounded-2xl p-8 relative overflow-hidden glass-card">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                    {t(lang, "join.gamejam")}
                                </h3>
                                <p className="leading-relaxed text-brand-text-body">
                                    {t(lang, "join.gamejamDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mb-12">
                        <p className="mt-10 text-brand-text-secondary">
                            {t(lang, "join.moreActivities")}
                        </p>
                    </div>
                </div>
            </section>

            {/* ── 作品试玩 ── */}
            <section className="py-16 join-g4">
                <div className="container mx-auto px-4 max-w-3xl text-center">
                    <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                        {t(lang, "join.brandLine")}
                    </p>
                    <h2 className="text-3xl font-bold mb-8 text-brand-navy">
                        {t(lang, "join.playtest")}
                    </h2>

                    {/* Top 3 热门作品 */}
                    {top3.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                            {top3.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/works/${p.slug}`}
                                    className="group rounded-xl overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 glass-card"
                                >
                                    <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                        {p.coverImage ? (
                                            <Image
                                                src={p.coverImage}
                                                alt={p.title}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                sizes="(max-width: 640px) 100vw, 33vw"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-[#E6F0F8]">
                                                <Image src="/images/logo.png" alt="" width={28} height={28} className="opacity-30"/>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 text-left">
                                        <h4 className="font-medium text-sm truncate group-hover:text-brand-blue transition-colors text-brand-text-heading">
                                            {p.title}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-brand-text-muted">{p.developYear}</span>
                                            <span className="text-xs text-brand-orange">❤️ {p._count.likes}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    <a
                        href="/works"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-block px-8 py-3 rounded-lg font-medium text-sm"
                    >
                        {t(lang, "join.moreWorks")}
                    </a>
                </div>
            </section>

            {/* ── 关注我们 ── */}
            <section className="py-16 mx-auto px-4 join-g5">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                            {t(lang, "join.brandLine")}
                        </p>
                        <h2 className="text-3xl font-bold text-brand-navy">
                            {t(lang, "join.followUs")}
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* QQ群 */}
                        <div className="rounded-2xl p-6 text-center glass-card">
                            <Image
                                src="/images/join/QQ.png"
                                alt="QQ"
                                width={64}
                                height={64}
                                className="mx-auto mb-4"
                            />
                            <h3 className="font-semibold mb-2 text-brand-text-heading">{t(lang, "join.qqGroupTitle")}</h3>
                            <p className="text-sm mb-4 text-brand-text-secondary">{t(lang, "join.qqGroupDesc")}</p>
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt={t(lang, "join.qqGroupTitle")}
                                width={160}
                                height={160}
                                className="mx-auto rounded-lg"
                            />
                        </div>

                        {/* 微信公众号 */}
                        <div className="rounded-2xl p-6 text-center glass-card">
                            <Image
                                src="/images/join/wechat.png"
                                alt={t(lang, "join.wechatTitle")}
                                width={64}
                                height={64}
                                className="mx-auto mb-4"
                            />
                            <h3 className="font-semibold mb-2 text-brand-text-heading">{t(lang, "join.wechatTitle")}</h3>
                            <p className="text-sm mb-4 text-brand-text-secondary">{t(lang, "join.wechatDesc")}</p>
                            <Image
                                src="/images/join/wx_2dcode.jpeg"
                                alt={t(lang, "join.wechatTitle")}
                                width={160}
                                height={160}
                                className="mx-auto rounded-lg"
                            />
                        </div>

                        {/* Bilibili */}
                        <div className="rounded-2xl p-6 text-center glass-card">
                            <Image
                                src="/images/join/bilibili.png"
                                alt="Bilibili"
                                width={64}
                                height={64}
                                className="mx-auto mb-4"
                            />
                            <h3 className="font-semibold mb-2 text-brand-text-heading">{t(lang, "join.bilibiliName")}</h3>
                            <p className="text-sm mb-3 text-brand-text-secondary">{t(lang, "join.bilibiliDesc")}</p>
                            <a
                                href="https://space.bilibili.com/2074896294"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-sm font-medium hover:underline text-brand-blue"
                            >
                                {t(lang, "join.bilibiliName")}
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 底部 CTA ── */}
            <section className="py-16 text-center join-g6">
                <div className="container mx-auto px-4 max-w-xl">
                    <Image
                        src="/images/logo.png"
                        alt={t(lang, "brand.name")}
                        width={56}
                        height={56}
                        className="mx-auto mb-4 rounded-lg"
                    />
                    <p className="text-sm font-medium mb-1 tracking-wider text-brand-blue">
                        {t(lang, "join.brandShort")}
                    </p>
                    <h2 className="text-3xl font-bold mb-3 text-brand-navy">
                        {t(lang, "join.brandBottom")}
                    </h2>
                    <p className="mb-6 leading-relaxed text-[#666]">
                        {t(lang, "join.bottomDesc")}
                    </p>
                </div>
            </section>
        </div>
    );
}
