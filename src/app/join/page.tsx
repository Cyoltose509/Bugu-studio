import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus} from "@prisma/client";

export const metadata: Metadata = {
    title: "招新信息",
    description: "了解布谷工作室招新信息、入会要求及新学期活动预告。",
};

export const dynamic = "force-dynamic";

export default async function JoinPage() {
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
                        alt="布谷工作室"
                        width={88}
                        height={88}
                        className="mx-auto mb-6 rounded-xl shadow-lg"
                        priority
                    />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-brand-navy">
                        加入布谷工作室
                    </h1>
                    <p className="text-lg mb-2 text-brand-text-body">
                        BUGOO STUDIO · 武汉大学
                    </p>
                    <p className="max-w-2xl mx-auto leading-relaxed text-brand-text-secondary">
                        布谷工作室，致力于为喜爱游戏设计和制作的同学提供环境和资源用于开发自己理想中的游戏，为游戏行业培养技术和美术等方向的人才。
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
                        BUGOO STUDIO · 布谷工作室
                    </p>
                    <h2 className="text-3xl font-bold text-brand-navy">
                        加入我们
                    </h2>
                </div>
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* 左侧：QQ 群二维码 (1/4) */}
                    <div className="md:col-span-1 flex flex-col items-center">
                        <div className="rounded-2xl p-6 w-full text-center glass-card">
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt="布谷招待所QQ群二维码"
                                width={200}
                                height={200}
                                className="mx-auto rounded-lg"
                            />
                            <p className="mt-4 text-sm text-brand-text-muted">
                                扫码加入布谷招待所大群
                            </p>
                            <p className="text-xs mt-1 text-brand-text-muted">获取更多动态</p>
                        </div>
                    </div>

                    {/* 右侧：Q&A (3/4) */}
                    <div className="md:col-span-3 space-y-6">
                        {/* Q1 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                Q：如何加入布谷工作室？
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                预计于九月中旬至十月中上旬进行统一的招新活动。在正式招新后我们会进行入门级游戏开发教学，为大家答疑解惑。此外我们也开设长期招新通道，可以扫描左侧二维码加入布谷QQ群了解详情。
                            </p>
                        </div>

                        {/* Q3 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                Q：在布谷工作室需要做什么？
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                我们没有硬性技术要求，与团队成员尽情讨论，培养自己开发游戏的爱好；参与游戏开发，参与各项比赛充实自己；探讨游戏行业未来的发展，共同创造无限可能。
                            </p>
                        </div>

                        {/* Q4 — 入会要求 */}
                        <div className="rounded-2xl p-6 glass-card">
                            <h3 className="text-lg font-semibold mb-3 text-brand-navy">
                                Q：入会考核要求是什么？
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                入会仅需向负责人提交一份自己的 Demo
                                作品（游戏、技术演示、美术作品集均可），并且线下审查。我们不追求"完美"，更看重你的学习热情和创作潜力。
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
                            BUGOO STUDIO · 布谷工作室
                        </p>
                        <h2 className="text-3xl font-bold text-brand-navy">
                            工作室主要活动
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 活动一：例会 */}
                        <div className="rounded-2xl p-8 glass-card">
                            <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                布谷例会
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                每两周举行一次的工作室例会，是成员之间交流分享的重要平台。内容包括近期项目进度同步、技术心得分享、行业话题讨论、活动规划说明等。无论你是哪个方向，例会都是融入团队、了解工作室动态的最佳方式。
                            </p>
                        </div>

                        {/* 活动二：公开课 */}
                        <div className="rounded-2xl p-8 glass-card">
                            <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                布谷公开课
                            </h3>
                            <p className="leading-relaxed text-brand-text-body">
                                以策划方向为主的公开课活动。报名者自选课题进行分享演讲，由评委打分评选出优秀论题，获奖者将获得精美奖品。公开课旨在鼓励大家深入思考游戏设计理论，锻炼表达与分享能力，同时也为新人提供展示自我的舞台。
                            </p>
                        </div>

                        {/* 活动三：Game Jam */}
                        <div className="rounded-2xl p-8 relative overflow-hidden glass-card">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-bold mb-3 text-center text-brand-navy">
                                    布谷 Game Jam
                                </h3>
                                <p className="leading-relaxed text-brand-text-body">
                                    预计在招新期间举办。比赛规则为一周内限时主题游戏开发，同学们自由组队，根据主题开发游戏
                                    Demo。赛前我们会邀请有经验的选手分享 Game Jam 参与经验。参与 Game Jam
                                    不仅能结交志同道合的朋友，还可以提升游戏设计水平、团队协作能力和游戏理解能力，为自己留下一段难忘的创作经历。
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mb-12">
                        <p className="mt-10 text-brand-text-secondary">
                            此外，我们还会多校联合，或与各知名公司等展开活动。
                        </p>
                    </div>
                </div>
            </section>

            {/* ── 作品试玩 ── */}
            <section className="py-16 join-g4">
                <div className="container mx-auto px-4 max-w-3xl text-center">
                    <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                        BUGOO STUDIO · 布谷工作室
                    </p>
                    <h2 className="text-3xl font-bold mb-8 text-brand-navy">
                        作品试玩
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
                        更多作品 →
                    </a>
                </div>
            </section>

            {/* ── 关注我们 ── */}
            <section className="py-16 mx-auto px-4 join-g5">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium mb-2 tracking-wider text-brand-blue">
                            BUGOO STUDIO · 布谷工作室
                        </p>
                        <h2 className="text-3xl font-bold text-brand-navy">
                            关注我们
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
                            <h3 className="font-semibold mb-2 text-brand-text-heading">布谷招待所 QQ群</h3>
                            <p className="text-sm mb-4 text-brand-text-secondary">扫码加入，获取动态</p>
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt="QQ群二维码"
                                width={160}
                                height={160}
                                className="mx-auto rounded-lg"
                            />
                        </div>

                        {/* 微信公众号 */}
                        <div className="rounded-2xl p-6 text-center glass-card">
                            <Image
                                src="/images/join/wechat.png"
                                alt="微信"
                                width={64}
                                height={64}
                                className="mx-auto mb-4"
                            />
                            <h3 className="font-semibold mb-2 text-brand-text-heading">微信公众号</h3>
                            <p className="text-sm mb-4 text-brand-text-secondary">扫码加入，获取最新资讯</p>
                            <Image
                                src="/images/join/wx_2dcode.jpeg"
                                alt="公众号二维码"
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
                            <h3 className="font-semibold mb-2 text-brand-text-heading">BiliBili</h3>
                            <p className="text-sm mb-3 text-brand-text-secondary">关注我们的视频频道</p>
                            <a
                                href="https://space.bilibili.com/2074896294"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-sm font-medium hover:underline text-brand-blue"
                            >
                                武汉大学布谷工作室
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
                        alt="布谷工作室"
                        width={56}
                        height={56}
                        className="mx-auto mb-4 rounded-lg"
                    />
                    <p className="text-sm font-medium mb-1 tracking-wider text-brand-blue">
                        BUGOO STUDIO
                    </p>
                    <h2 className="text-3xl font-bold mb-3 text-brand-navy">
                        布谷工作室
                    </h2>
                    <p className="mb-6 leading-relaxed text-[#666]">
                        我们期待每一个热爱游戏开发的你，一起探索无限可能。
                    </p>
                </div>
            </section>
        </div>
    );
}
