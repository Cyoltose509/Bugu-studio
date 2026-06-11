/**
 * Supabase / PostgreSQL 数据库综合管理页面
 * 整合：数据库统计、表空间占用、审计日志、备份管理、野表检测
 */

import {prisma} from "@/lib/db/prisma";
import Link from "next/link";
import CollapsibleTableStats from "@/components/admin/CollapsibleTableStats";
import OrphanTablesDetector from "@/components/admin/OrphanTablesDetector";
import AuditLogsSection from "@/components/admin/AuditLogsSection";
import BackupSection from "@/components/admin/BackupSection";

export const dynamic = "force-dynamic";

interface TableStat {
    table: string;
    size: string;
    rows: number;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function SupabaseMonitorPage() {
    let dbSize = "N/A";
    let dbSizeBytes = 0;
    let tableStats: TableStat[] = [];
    let connections = "N/A";
    let version = "N/A";
    let error: string | null = null;

    try {
        const sizeResult = await prisma.$queryRawUnsafe<{ size: string }[]>(
            `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
        );
        if (sizeResult.length > 0) dbSize = sizeResult[0].size;

        const sizeBytes = await prisma.$queryRawUnsafe<{ size: bigint }[]>(
            `SELECT pg_database_size(current_database()) as size`
        );
        if (sizeBytes.length > 0) dbSizeBytes = Number(sizeBytes[0].size);

        const rawStats = await prisma.$queryRawUnsafe<
            { relname: string; total_size: bigint; n_live_tup: bigint }[]
        >(`
            SELECT relname, pg_total_relation_size(relid) as total_size, n_live_tup
            FROM pg_stat_user_tables
            ORDER BY total_size DESC
        `);

        tableStats = rawStats
            .filter((r) => !r.relname.startsWith("_") && !r.relname.startsWith("pg_"))
            .map((r) => ({
                table: r.relname,
                size: formatBytes(Number(r.total_size)),
                rows: Number(r.n_live_tup),
            }));

        const connResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT count(*) as count
             FROM pg_stat_activity`
        );
        if (connResult.length > 0) connections = String(connResult[0].count);

        const verResult = await prisma.$queryRawUnsafe<{ version: string }[]>(
            `SELECT version()`
        );
        if (verResult.length > 0) version = verResult[0].version;
    } catch (e: any) {
        error = e.message || "查询失败";
        console.error("[monitor/supabase]", e);
    }

    return (
        <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <Link href="/admin/monitoring" className="text-sm hover:underline" style={{color: "#3388BB"}}>
                    ← 监控总览
                </Link>
                <h1 className="text-2xl font-bold" style={{color: "#25547A"}}>
                    🗄️ 数据库管理
                </h1>
                {/* 子页面快捷入口 */}
                <div className="ml-auto flex gap-2">
                    <Link href="/admin/monitoring/r2" className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                          style={{borderColor: "#D0DEE8", color: "#555"}}>
                        📦 R2 存储
                    </Link>
                    <Link href="/admin/monitoring/resend"
                          className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                          style={{borderColor: "#D0DEE8", color: "#555"}}>
                        ✉️ 邮件监控
                    </Link>
                </div>
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm" style={{color: "#C62828"}}>
                    查询失败：{error}
                </div>
            ) : (
                <div className="space-y-8">
                    {/* ============ 第 1 节：概览统计 ============ */}
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <StatCard label="数据库大小" value={dbSize} icon="💾" color="#3ECF8E"/>
                            <StatCard label="当前连接" value={connections} icon="🔗" color="#3388BB"/>
                            <StatCard label="用户表数" value={String(tableStats.length)} icon="📊" color="#E8A040"/>
                            <StatCard label="总行数" value={String(tableStats.reduce((sum, t) => sum + t.rows, 0))} icon="📝"
                                      color="#88C232"/>
                        </div>
                        <div className="bg-white border rounded-lg p-3 text-xs" style={{borderColor: "#D0DEE8", color: "#777"}}>
                            {version}
                        </div>
                    </section>

                    {/* ============ 第 2 节：表空间占用（折叠展开） ============ */}
                    <section>
                        <h2 className="text-lg font-semibold mb-3" style={{color: "#25547A"}}>
                            📁 表空间占用
                        </h2>
                        <CollapsibleTableStats tableStats={tableStats} dbSizeBytes={dbSizeBytes}/>
                    </section>

                    {/* ============ 第 3 节：审计日志 ============ */}
                    <section>
                        <AuditLogsSection/>
                    </section>

                    {/* ============ 第 4 节：备份管理 ============ */}
                    <section>
                        <BackupSection/>
                    </section>

                    {/* ============ 第 5 节：野表检测 ============ */}
                    <section>
                        <OrphanTablesDetector/>
                    </section>
                </div>
            )}
        </div>
    );
}

function StatCard({label, value, icon, color}: { label: string; value: string; icon: string; color: string }) {
    return (
        <div className="bg-white border rounded-xl p-4 shadow-sm" style={{borderColor: "#D0DEE8"}}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="text-xs" style={{color: "#777"}}>{label}</span>
            </div>
            <div className="text-2xl font-bold" style={{color}}>{value}</div>
        </div>
    );
}
