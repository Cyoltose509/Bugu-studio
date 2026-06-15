/**
 * CSP 违规报告看板
 * 
 * 展示浏览器报告的 Content-Security-Policy 违规情况：
 *   - 违规指令分布
 *   - 被阻止的 URI
 *   - 发生页面
 *   - 详细报告列表（分页 + 自动刷新）
 * 
 * 用途：
 *   1. 发现 XSS 攻击尝试
 *   2. 发现 CSP 策略配置错误（误拦了合法资源）
 *   3. 辅助 CSP 策略调优
 */

import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import CspReportsClient from "@/components/admin/CspReportsClient";

export const dynamic = "force-dynamic";

export default async function CspReportsPage() {
  // 初始加载数据
  let stats = {
    totalUnique: 0,
    totalEvents: 0,
    last24h: 0,
    byDirective: [] as { directive: string; uniqueReports: number; totalEvents: number }[],
  };
  let error: string | null = null;

  try {
    const [totalUnique, last24h, totalEventsAgg, byDirective] = await Promise.all([
      prisma.cspReport.count(),
      prisma.cspReport.count({
        where: { firstSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.cspReport.aggregate({ _sum: { count: true } }),
      prisma.cspReport.groupBy({
        by: ["violatedDirective"],
        _count: { id: true },
        _sum: { count: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ]);

    stats = {
      totalUnique,
      totalEvents: totalEventsAgg._sum.count ?? 0,
      last24h,
      byDirective: byDirective.map((d) => ({
        directive: d.violatedDirective,
        uniqueReports: d._count.id,
        totalEvents: d._sum.count ?? 0,
      })),
    };
  } catch (e: any) {
    error = e.message ?? "数据库查询失败";
  }

  return (
    <div className="animate-fade-in">
      {/* 头部导航 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/admin/monitoring" className="text-sm hover:underline text-brand-blue">
          ← 监控总览
        </Link>
        <h1 className="text-2xl font-bold text-brand-navy">🛡️ CSP 违规报告</h1>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          加载失败：{error}
        </div>
      ) : (
        <CspReportsClient initialStats={stats} />
      )}
    </div>
  );
}
