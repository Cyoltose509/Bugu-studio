import Link from "next/link";
import Image from "next/image";

export function Footer() {
    const currentYear = new Date().getFullYear();
    const foundedYear = parseInt(process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2018");

    return (
        <footer className="border-t" style={{borderColor: "#D0DEE8", background: "#F0F5F9"}}>
            <main className="flex-1 relative">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: "url(/images/geo_pattern.png)",
                        backgroundRepeat: "repeat",
                        backgroundSize: "600px",
                        opacity: 0.06,
                        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)",
                        zIndex: 0,
                    }}
                />
                <div className="relative" style={{zIndex: 1}}>
                    <div className="container mx-auto px-4 py-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Image src="/images/logo.png" alt="布谷工作室" width={28} height={28} className="rounded"/>
                                    <span className="font-bold" style={{color: "#25547A"}}>布谷工作室</span>
                                </div>
                                <p className="text-sm" style={{color: "#777"}}>
                                    致力于游戏开发的探索与创造。
                                </p>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-3" style={{color: "#333"}}>快速链接</h3>
                                <ul className="space-y-2 text-sm" style={{color: "#777"}}>
                                    <li><Link href="/works" className="hover:text-[#3388BB] transition-colors">作品库</Link></li>
                                    <li><Link href="/members" className="hover:text-[#3388BB] transition-colors">成员列表</Link></li>
                                    <li><Link href="/activities" className="hover:text-[#3388BB] transition-colors">社团活动</Link></li>
                                    <li><Link href="/history" className="hover:text-[#3388BB] transition-colors">社团历史</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-3" style={{color: "#333"}}>关注我们</h3>
                                <ul className="space-y-2 text-sm" style={{color: "#777"}}>
                                    <li><a href="https://space.bilibili.com/2074896294" target="_blank" rel="noopener noreferrer"
                                           className="hover:text-[#3388BB] transition-colors">Bilibili 账号</a></li>
                                    <li><a href="/join" target="_blank" rel="noopener noreferrer"
                                           className="hover:text-[#3388BB] transition-colors">招新信息</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-3"
                             style={{borderColor: "#D0DEE8"}}>
                            <p className="text-xs" style={{color: "#999"}}>
                                {"\u00A9"} {foundedYear}–{currentYear} 布谷工作室 · 保留所有权利
                            </p>
                            <div className="flex gap-4 text-xs" style={{color: "#999"}}>
                                <Link href="/privacy" className="hover:text-[#555]">隐私政策</Link>
                                <Link href="/terms" className="hover:text-[#555]">使用条款</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

        </footer>
    );
}
