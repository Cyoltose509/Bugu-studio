import type {Metadata, Viewport} from "next";
import {Suspense} from "react";
import {Inter} from "next/font/google";
import "./globals.css";
import {Providers} from "@/components/providers/Providers";
import {Navbar} from "@/components/layout/Navbar";
import {NavbarSkeleton} from "@/components/layout/NavbarSkeleton";
import {Footer} from "@/components/layout/Footer";
import {SkipLink} from "@/components/layout/SkipLink";
import TopLoader from "@/components/layout/TopLoader";
import {SpeedInsights} from "@vercel/speed-insights/next";
import {Analytics} from "@vercel/analytics/react";

const inter = Inter({subsets: ["latin"], display: "swap", preload: true});

export const metadata: Metadata = {
    title: {template: "%s | 布谷工作室", default: "布谷工作室 - 官方网站"},
    description: "布谷工作室官方网站，展示历届成员作品与社团历史。",
    keywords: ["游戏开发", "社团"],
    icons: {icon: "/images/logo.png", apple: "/images/logo.png", shortcut: "/images/logo.png"},
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
        <head>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
            {/* 在页面渲染前设置 dark class，避免 hydration mismatch */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
          `.trim(),
                }}
            />
        </head>
        <body className={`${inter.className} text-[#333333] min-h-screen flex flex-col`}>
        <SkipLink />
        <TopLoader />
        <Providers>
            {/* Navbar 用 Suspense 包裹 — auth() 不阻塞首屏渲染 */}
            <Suspense fallback={<NavbarSkeleton/>}>
                <Navbar/>
            </Suspense>
            <main id="main-content" className="flex-1 relative" role="main">
                <div className="absolute inset-0 pointer-events-none texture-bg texture-bg--fade-down" />
                <div className="relative z-[1]">{children}</div>
            </main>
            <Footer/>
        </Providers>
        <SpeedInsights/>
        <Analytics/>
        </body>
        </html>
    );
}
