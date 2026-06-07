/**
 * 页脚组件
 */

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const foundedYear = parseInt(process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2018");

  return (
    <footer className="border-t border-white/10 bg-gray-950 mt-16">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 社团简介 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎮</span>
              <span className="font-bold text-white">布谷工作室</span>
            </div>
            <p className="text-sm text-gray-400">
              成立于 {foundedYear} 年，致力于游戏开发的探索与创造。
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">快速链接</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/works" className="hover:text-white transition-colors">作品库</Link></li>
              <li><Link href="/members" className="hover:text-white transition-colors">成员列表</Link></li>
              <li><Link href="/history" className="hover:text-white transition-colors">社团历史</Link></li>
            </ul>
          </div>

          {/* 外部链接 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">关注我们</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href="https://store.steampowered.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Steam 主页
                </a>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub 组织
                </a>
              </li>
              <li>
                <a
                  href="https://itch.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Itch.io 主页
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-500">
            © {foundedYear}–{currentYear} 布谷工作室 · 保留所有权利
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-gray-300">隐私政策</Link>
            <Link href="/terms" className="hover:text-gray-300">使用条款</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
