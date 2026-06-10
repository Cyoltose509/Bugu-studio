/**
 * Supabase / PostgreSQL 数据库监控页面
 * 通过 Prisma raw query 查询 pg 系统表
 */

import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

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
    // 数据库总大小
    const sizeResult = await prisma.$queryRawUnsafe<{ size: string }[]>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    );
    if (sizeResult.length > 0) dbSize = sizeResult[0].size;

    const sizeBytes = await prisma.$queryRawUnsafe<{ size: bigint }[]>(
      `SELECT pg_database_size(current_database()) as size`
    );
    if (sizeBytes.length > 0) dbSizeBytes = Number(sizeBytes[0].size);

    // 各表大小和行数
    const rawStats = await prisma.$queryRawUnsafe<
      { relname: string; total_size: bigint; n_live_tup: bigint }[]
    >(`
      SELECT
        relname,
        pg_total_relation_size(relid) as total_size,
        n_live_tup
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

    // 当前连接数
    const connResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) as count FROM pg_stat_activity`
    );
    if (connResult.length > 0) connections = String(connResult[0].count);

    // PostgreSQL 版本
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
        <Link
          href="/admin/monitoring"
          className="text-sm hover:underline"
          style={{ color: "#3388BB" }}
        >
          ← 监控总览
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>
          🗄️ Supabase 数据库
        </h1>
      </div>

      {error ? (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm"
          style={{ color: "#C62828" }}
        >
          查询失败：{error}
        </div>
      ) : (
        <>
          {/* 概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="数据库大小"
              value={dbSize}
              icon="💾"
              color="#3ECF8E"
            />
            <StatCard
              label="当前连接"
              value={connections}
              icon="🔗"
              color="#3388BB"
            />
            <StatCard
              label="用户表数"
              value={String(tableStats.length)}
              icon="📊"
              color="#E8A040"
            />
            <StatCard
              label="总行数"
              value={String(
                tableStats.reduce((sum, t) => sum + t.rows, 0)
              )}
              icon="📝"
              color="#88C232"
            />
          </div>

          {/* 版本信息 */}
          <div
            className="bg-white border rounded-lg p-3 mb-6 text-xs"
            style={{ borderColor: "#D0DEE8", color: "#777" }}
          >
            {version}
          </div>

          {/* 表详情 */}
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>
            表空间占用
          </h2>
          <div
            className="bg-white border rounded-lg overflow-hidden"
            style={{ borderColor: "#D0DEE8" }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: "#F0F5FA" }}>
                <tr>
                  <th
                    className="text-left px-4 py-2.5 font-medium"
                    style={{ color: "#555" }}
                  >
                    表名
                  </th>
                  <th
                    className="text-right px-4 py-2.5 font-medium"
                    style={{ color: "#555" }}
                  >
                    大小
                  </th>
                  <th
                    className="text-right px-4 py-2.5 font-medium"
                    style={{ color: "#555" }}
                  >
                    行数
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tableStats.map((t) => (
                  <tr
                    key={t.table}
                    className="border-t"
                    style={{ borderColor: "#E6F0F8" }}
                  >
                    <td
                      className="px-4 py-2.5 font-mono text-xs"
                      style={{ color: "#333" }}
                    >
                      {t.table}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right font-mono text-xs"
                      style={{ color: "#555" }}
                    >
                      {t.size}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right font-mono text-xs"
                      style={{ color: "#555" }}
                    >
                      {t.rows.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${Math.min(100, dbSizeBytes > 0 ? (t.rows / Math.max(1, tableStats.reduce((s, x) => s + x.rows, 0))) * 100 * 5 : 0)}px`,
                          minWidth: "4px",
                          background: "#3ECF8E",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-4 shadow-sm"
      style={{ borderColor: "#D0DEE8" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs" style={{ color: "#777" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
