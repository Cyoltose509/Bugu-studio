import type {Metadata, Viewport} from "next";
import {Suspense} from "react";
import {Inter, Nunito} from "next/font/google";
import "./globals.css";
import {Providers} from "@/components/providers/Providers";
import {Navbar} from "@/components/layout/Navbar";
import {NavbarSkeleton} from "@/components/layout/NavbarSkeleton";
import {Footer} from "@/components/layout/Footer";
import {getLang} from "@/lib/i18n/getLang";
import {t} from "@/lib/i18n/dict";
import {SkipLink} from "@/components/layout/SkipLink";
import TopLoader from "@/components/layout/TopLoader";
import {SpeedInsights} from "@vercel/speed-insights/next";
import {Analytics} from "@vercel/analytics/react";

const inter = Inter({subsets: ["latin"], display: "swap", preload: true, variable: "--font-inter"});
// 英文模式专用字体：Nunito —— 圆润、友好、易读，贴合布谷娘吉祥物与暖色品牌调性
const nunito = Nunito({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-en",
    weight: ["400", "500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
    const lang = await getLang();
    return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://bugoostudio.com"),
        title: {template: t(lang, "meta.titleTemplate"), default: t(lang, "meta.titleDefault")},
        description: t(lang, "meta.description"),
        keywords: t(lang, "meta.keywords").split(","),
        icons: {
            icon: [
                { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
                { url: "/images/favicon-192.png", sizes: "192x192", type: "image/png" },
            ],
            apple: "/images/apple-touch-icon.png",
            shortcut: "/images/favicon-32.png",
        },
        openGraph: {
            type: "website",
            locale: lang === "en" ? "en_US" : "zh_CN",
            siteName: t(lang, "meta.siteName"),
            title: t(lang, "meta.titleDefault"),
            description: t(lang, "meta.description"),
            images: [{ url: "/images/logo.png", width: 512, height: 512 }],
        },
        twitter: {
            card: "summary",
            title: t(lang, "meta.titleDefault"),
            description: t(lang, "meta.description"),
            images: ["/images/logo.png"],
        },
        alternates: {
            canonical: "/",
        },
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true },
        },
    };
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

export default async function RootLayout({children}: { children: React.ReactNode }) {
    const lang = await getLang();
    return (
        <html lang={lang === "en" ? "en" : "zh-CN"} suppressHydrationWarning className={`${inter.variable} ${nunito.variable}`}>
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
        <body className="text-[#333333] min-h-screen flex flex-col">
        <SkipLink />
        <TopLoader />
        <Providers initialLang={lang}>
            {/* Navbar 用 Suspense 包裹 — auth() 不阻塞首屏渲染 */}
            <Suspense fallback={<NavbarSkeleton lang={lang}/>}>
                <Navbar lang={lang}/>
            </Suspense>
            <main id="main-content" className="flex-1 relative" role="main">
                <div className="absolute inset-0 pointer-events-none texture-bg texture-bg--fade-down" />
                <div className="relative z-[1]">{children}</div>
            </main>
            <Footer lang={lang}/>
        </Providers>
        <SpeedInsights/>
        <Analytics/>
        </body>
        </html>
    );
}
