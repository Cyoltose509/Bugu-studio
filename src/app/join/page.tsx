import type {Metadata} from "next";
import Image from "next/image";

export const metadata: Metadata = {
    title: "招新信息",
    description: "了解布谷工作室招新信息、入会要求及新学期活动预告。",
};

// 页面内容静态，但允许 layout 中的 Navbar 动态读取 session
export const dynamic = "force-dynamic";

export default function JoinPage() {
    return (
        <div className="animate-fade-in">
            {/* ── Hero / 工作室简介 ── */}
            <section
                className="relative overflow-hidden px-4 py-20 md:py-28 text-center"
                style={{background: "linear-gradient(180deg, #E6F0F8 0%, #D0E4F0 100%)"}}
            >
                <div className="container mx-auto max-w-3xl relative z-10">
                    <Image
                        src="/images/logo.png"
                        alt="布谷工作室"
                        width={88}
                        height={88}
                        className="mx-auto mb-6 rounded-xl shadow-lg"
                        priority
                    />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{color: "#25547A"}}>
                        加入布谷工作室
                    </h1>
                    <p className="text-lg mb-2" style={{color: "#555"}}>
                        Bugoo Studio · 武汉大学
                    </p>
                    <p className="max-w-2xl mx-auto leading-relaxed" style={{color: "#666"}}>
                        武汉大学布谷工作室原身是国际软件学院天行工作室，后国软并入计算机学院作为软件工程专业，天行工作室也并入珞珈技术俱乐部作为游戏部，同时正式更名为布谷工作室。
                        工作室致力于为喜爱游戏设计和制作的同学提供环境和资源用于开发自己理想中的游戏，为游戏行业培养技术和美术等方向的人才。
                    </p>
                </div>
                {/* 背景装饰 */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div
                        className="absolute -top-20 -right-20 w-64 h-64 rounded-full"
                        style={{background: "radial-gradient(circle, rgba(51,136,187,0.15) 0%, transparent 70%)"}}
                    />
                    <div
                        className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full"
                        style={{background: "radial-gradient(circle, rgba(227,128,67,0.12) 0%, transparent 70%)"}}
                    />
                </div>
            </section>


            {/* ── 加入我们 Q&A ── */}
            <section className="py-16 container mx-auto px-4">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold mb-10 text-center" style={{color: "#25547A"}}>
                        加入我们
                    </h2>

                    <div className="space-y-8">
                        {/* Q1 */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <h3 className="text-lg font-semibold mb-3" style={{color: "#25547A"}}>
                                Q：如何加入布谷工作室？
                            </h3>
                            <p className="leading-relaxed" style={{color: "#555"}}>
                                预计于九月中旬至十月中上旬进行统一的招新活动。在正式招新后我们会进行入门级游戏开发教学，为大家答疑解惑。此外我们也开设长期招新通道，可以扫描下方二维码加入布谷QQ群了解详情。
                            </p>
                        </div>

                        {/* Q3 */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <h3 className="text-lg font-semibold mb-3" style={{color: "#25547A"}}>
                                Q：在布谷工作室需要做什么？
                            </h3>
                            <p className="leading-relaxed" style={{color: "#555"}}>
                                我们没有硬性技术要求，与团队成员尽情讨论，培养自己开发游戏的爱好；参与游戏开发，参与各项比赛充实自己；探讨游戏行业未来的发展，共同创造无限可能。
                            </p>
                        </div>

                        {/* Q4 — 入会要求 */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <h3 className="text-lg font-semibold mb-3" style={{color: "#25547A"}}>
                                Q：入会考核要求是什么？
                            </h3>
                            <p className="leading-relaxed" style={{color: "#555"}}>
                                入会仅需向负责人提交一份自己的 Demo
                                作品（游戏、技术演示、美术作品集均可），并且线下审查。我们不追求"完美"，更看重你的学习热情和创作潜力。
                            </p>
                        </div>
                    </div>

                    {/* QQ 群二维码 */}
                    <div className="mt-12 text-center">
                        <div className="inline-block bg-white rounded-2xl p-6 shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt="布谷招待所QQ群二维码"
                                width={240}
                                height={240}
                                className="mx-auto rounded-lg"
                            />
                            <p className="mt-3 text-sm" style={{color: "#777"}}>
                                ↑ 扫码加入布谷招待所大群获取更多动态
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 新学期活动预告 ── */}
            <section
                className="py-16"
                style={{background: "linear-gradient(180deg, #F0F5F9 0%, #E6F0F8 100%)"}}
            >
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium mb-2 tracking-wider" style={{color: "#3388BB"}}>
                            BUGOO STUDIO · 布谷工作室
                        </p>
                        <h2 className="text-3xl font-bold" style={{color: "#25547A"}}>
                            工作室主要活动
                        </h2>
                        <p className="mt-3" style={{color: "#777"}}>
                            此外，我们还会多校联合，或与各知名公司等展开活动。
                        </p>
                    </div>

                    <div className="space-y-12">
                        {/* 活动一：例会 */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="grid md:grid-cols-5 gap-0">
                                <div className="md:col-span-2">
                                    <Image
                                        src="/images/logo.png"
                                        alt="布谷工作室例会"
                                        width={600}
                                        height={400}
                                        className="w-full h-full object-cover"
                                        style={{minHeight: 280}}
                                    />
                                </div>
                                <div className="md:col-span-3 p-8 flex flex-col justify-center">
                                    <h3 className="text-2xl font-bold mb-3" style={{color: "#25547A"}}>
                                        布谷例会
                                    </h3>
                                    <p className="leading-relaxed" style={{color: "#555"}}>
                                        每两周举行一次的工作室例会，是成员之间交流分享的重要平台。内容包括近期项目进度同步、技术心得分享、行业话题讨论、活动规划说明等。无论你是哪个方向，例会都是融入团队、了解工作室动态的最佳方式。
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 活动二：公开课 */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="grid md:grid-cols-5 gap-0">
                                <div className="md:col-span-3 p-8 flex flex-col justify-center order-2 md:order-1">
                                    <h3 className="text-2xl font-bold mb-3" style={{color: "#25547A"}}>
                                        布谷公开课
                                    </h3>
                                    <p className="leading-relaxed" style={{color: "#555"}}>
                                        以策划方向为主的公开课活动。报名者自选课题进行分享演讲，由评委打分评选出优秀论题，获奖者将获得精美奖品。公开课旨在鼓励大家深入思考游戏设计理论，锻炼表达与分享能力，同时也为新人提供展示自我的舞台。
                                    </p>
                                </div>
                                <div className="md:col-span-2 order-1 md:order-2">
                                    <Image
                                        src="/images/logo.png"
                                        alt="布谷公开课"
                                        width={600}
                                        height={400}
                                        className="w-full h-full object-cover"
                                        style={{minHeight: 280}}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 活动三：Game Jam */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="grid md:grid-cols-5 gap-0">
                                <div className="md:col-span-2">
                                    <Image
                                        src="/images/join/game_jam.webp"
                                        alt="布谷GameJam"
                                        width={600}
                                        height={400}
                                        className="w-full h-full object-cover"
                                        style={{minHeight: 280}}
                                    />
                                </div>
                                <div className="md:col-span-3 p-8 flex flex-col justify-center">
                                    <h3 className="text-2xl font-bold mb-3" style={{color: "#25547A"}}>
                                        布谷 Game Jam
                                    </h3>
                                    <p className="leading-relaxed" style={{color: "#555"}}>
                                        预计在招新期间举办。比赛规则为一周内限时主题游戏开发，同学们自由组队，根据主题开发游戏
                                        Demo。赛前我们会邀请有经验的选手分享 Game Jam 参与经验。参与 Game Jam
                                        不仅能结交志同道合的朋友，还可以提升游戏设计水平、团队协作能力和游戏理解能力，为自己留下一段难忘的创作经历。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 作品试玩 ── */}
            <section
                className="py-16"
                style={{background: "linear-gradient(180deg, #F0F5F9 0%, #E6F0F8 100%)"}}
            >
                <div className="container mx-auto px-4 max-w-3xl text-center">
                    <p className="text-sm font-medium mb-2 tracking-wider" style={{color: "#3388BB"}}>
                        BUGOO STUDIO · 布谷工作室
                    </p>
                    <h2 className="text-3xl font-bold mb-8" style={{color: "#25547A"}}>
                        作品试玩
                    </h2>
                    <a
                        href="/works"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-block px-8 py-3 rounded-lg font-medium text-sm"
                    >
                        工作室游戏作品 →
                    </a>
                </div>
            </section>

            {/* ── 关注我们 ── */}
            <section className="py-16 container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-10 text-center" style={{color: "#25547A"}}>
                        关注我们
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* QQ群 */}
                        <div className="bg-white rounded-2xl p-6 text-center shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                 style={{background: "#E6F0F8"}}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3388BB" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-2" style={{color: "#333"}}>布谷招待所 QQ群</h3>
                            <p className="text-sm mb-4" style={{color: "#777"}}>扫码加入，获取动态</p>
                            <Image
                                src="/images/join/qq_2dcode.webp"
                                alt="QQ群二维码"
                                width={160}
                                height={160}
                                className="mx-auto rounded-lg"
                            />
                        </div>

                        {/* 微信公众号 */}
                        <div className="bg-white rounded-2xl p-6 text-center shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                 style={{background: "#E8F5E9"}}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5B8C5A" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="6" width="20" height="12" rx="2"/>
                                    <path d="M12 12h.01"/>
                                    <path d="M17 12h.01"/>
                                    <path d="M7 12h.01"/>
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-2" style={{color: "#333"}}>微信公众号</h3>
                            <p className="text-sm mb-4" style={{color: "#777"}}>扫码加入，获取最新资讯</p>
                            <Image
                                src="/images/join/wx_2dcode.jpeg"
                                alt="公众号二维码"
                                width={160}
                                height={160}
                                className="mx-auto rounded-lg"
                            />
                        </div>

                        {/* Bilibili */}
                        <div className="bg-white rounded-2xl p-6 text-center shadow-sm" style={{border: "1px solid #D0DEE8"}}>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                 style={{background: "#FDE8E8"}}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E38043" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-2" style={{color: "#333"}}>BiliBili</h3>
                            <p className="text-sm mb-3" style={{color: "#777"}}>关注我们的视频频道</p>
                            <a
                                href="https://space.bilibili.com/2074896294"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-sm font-medium hover:underline"
                                style={{color: "#3388BB"}}
                            >
                                武汉大学布谷工作室
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 底部 CTA ── */}
            <section
                className="py-16 text-center"
                style={{background: "linear-gradient(180deg, #E6F0F8 0%, #D0E4F0 100%)"}}
            >
                <div className="container mx-auto px-4 max-w-xl">
                    <Image
                        src="/images/logo.png"
                        alt="布谷工作室"
                        width={56}
                        height={56}
                        className="mx-auto mb-4 rounded-lg"
                    />
                    <p className="text-sm font-medium mb-1 tracking-wider" style={{color: "#3388BB"}}>
                        BUGOO STUDIO
                    </p>
                    <h2 className="text-3xl font-bold mb-3" style={{color: "#25547A"}}>
                        布谷工作室
                    </h2>
                    <p className="mb-6 leading-relaxed" style={{color: "#666"}}>
                        我们期待每一个热爱游戏开发的你，一起探索无限可能。
                    </p>
                </div>
            </section>
        </div>
    );
}
