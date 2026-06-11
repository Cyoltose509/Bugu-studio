import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { NavbarSkeleton } from "@/components/layout/NavbarSkeleton";
import { Footer } from "@/components/layout/Footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true });

export const metadata: Metadata = {
  title: { template: "%s | 布谷工作室", default: "布谷工作室 - 官方网站" },
  description: "布谷工作室官方网站，展示历届成员作品与社团历史。",
  keywords: ["游戏开发", "社团", "独立游戏", "Game Jam", "Unity", "Unreal"],
  icons: { icon: "/images/logo.png", apple: "/images/logo.png", shortcut: "/images/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} text-[#333333] min-h-screen flex flex-col`}>
        <Providers>
          {/* Navbar 用 Suspense 包裹 — auth() 不阻塞首屏渲染 */}
          <Suspense fallback={<NavbarSkeleton />}>
            <Navbar />
          </Suspense>
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
