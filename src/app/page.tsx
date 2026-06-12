/**
 * 首页 - 布谷工作室
 * 使用 Suspense 拆分：统计数据立即显示，作品列表流式加载
 */
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import HomeStats from "./HomeStats";
import LatestProjects from "./LatestProjects";
import HomeActivities from "./HomeActivities";

export const metadata = { title: "布谷工作室" };
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28 text-center" style={{ background: "linear-gradient(180deg, #E6F0F8 0%, #D0E4F0 100%)" }}>
        <div className="container mx-auto max-w-3xl relative">
          <Image src="/images/logo.png" alt="布谷工作室" width={96} height={96} className="mx-auto mb-6 rounded-xl shadow-lg" priority />
          <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: "#25547A" }}>布谷工作室</h1>
          <p className="text-xl mb-3" style={{ color: "#555" }}>官方网站</p>
          <p className="mb-8 max-w-xl mx-auto" style={{ color: "#777" }}>
            我们是一群热爱游戏开发的同学，这里存档了历届社员的每一份作品与心血。
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/works" className="btn-primary px-6 py-3 rounded-lg font-medium text-sm">浏览作品</Link>
            <Link href="/members" className="btn-secondary px-6 py-3 rounded-lg font-medium text-sm">认识成员</Link>
          </div>
        </div>
      </section>

      {/* 统计数据 — 直接加载（快） */}
      <Suspense fallback={<StatsSkeleton />}>
        <HomeStats />
      </Suspense>

      {/* 最新作品 — 流式加载（展示 6 个） */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold" style={{ color: "#25547A" }}>最新作品</h2>
          <Link href="/works" className="text-sm hover:underline" style={{ color: "#3388BB" }}>查看全部 →</Link>
        </div>
        <Suspense fallback={<ProjectGridSkeleton count={6} />}>
          <LatestProjects />
        </Suspense>
      </section>

      {/* 近期活动 */}
      <Suspense fallback={<div className="py-10 text-center text-gray-400 text-sm">加载活动中…</div>}>
        <HomeActivities />
      </Suspense>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-4 max-w-xl">
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#25547A" }}>想加入我们？</h2>
          <p className="mb-6" style={{ color: "#777" }}>每学年开放招新，欢迎对游戏开发充满热情的同学加入。</p>
          <Link href="/join" className="btn-primary inline-block px-8 py-3 rounded-lg font-medium text-sm">了解招新信息</Link>
        </div>
      </section>
    </div>
  );
}

/* ── 骨架屏 ────────────────────────────────── */

function StatsSkeleton() {
  return (
    <div className="py-10 border-y animate-pulse" style={{ borderColor: "#D0DEE8" }}>
      <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-2">
            <div className="mx-auto w-16 h-7 rounded bg-gray-200" />
            <div className="mx-auto w-20 h-4 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectGridSkeleton({ count }: { count: number }) {
  const cols = count === 4 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid ${cols} gap-6 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
          <div className="aspect-video bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="w-3/4 h-5 rounded bg-gray-200" />
            <div className="w-full h-4 rounded bg-gray-200" />
            <div className="w-2/3 h-4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
