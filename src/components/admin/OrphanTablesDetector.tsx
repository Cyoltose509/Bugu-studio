"use client";

import { useState } from "react";

/** 数据库野表检测 — 对比 DB 实际表 vs Prisma schema 模型 */
export default function OrphanTablesDetector() {
  const [loading, setLoading] = useState(false);
  const [orphans, setOrphans] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function detect() {
    setLoading(true);
    setError(null);
    setOrphans([]);
    setMissing([]);

    try {
      const res = await fetch("/api/admin/db/orphan-tables");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "检测失败");

      setDbTables(data.dbTables);
      setOrphans(data.orphans);
      setMissing(data.missing);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-brand-border-subtle p-6 shadow-sm bg-card"
    >
      <h3 className="text-lg font-semibold mb-1 text-brand-navy">
        🗂️ 野表检测
      </h3>
      <p className="text-sm mb-4 text-brand-text-muted">
        对比数据库实际表 vs Prisma schema 模型，找出"数据库有但 schema
        没有"的野表（通常是旧模型删除后未清理残留的表）
      </p>

      <button
        onClick={detect}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${
          loading ? "bg-[#aaa]" : "bg-brand-navy"
        }`}
      >
        {loading ? "检测中…" : "🔍 检测野表"}
      </button>

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          ⚠️ {error}
        </div>
      )}

      {/* 检测结果 */ }
      {!loading && (orphans.length > 0 || missing.length > 0 || dbTables.length > 0) && (
        <div className="mt-4 space-y-4">
          {/* 野表 */ }
          {orphans.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#C0392B]">
                ⚠️ 发现 {orphans.length} 张野表（DB 有，schema 无）
              </h4>
              <div className="overflow-x-auto rounded-lg border border-[#E6F0F8]">
                <table className="w-full text-sm">
                  <thead className="bg-[#FFF5F5]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">表名</th>
                      <th className="text-left px-3 py-2 font-medium">建议操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphans.map((t, idx) => (
                      <tr
                        key={`${t}-${idx}`}
                        className="border-t border-[#F0E0E0]"
                      >
                        <td className="px-3 py-2 font-mono text-[#C0392B]">
                          {t}
                        </td>
                        <td className="px-3 py-2 text-xs text-brand-text-muted">
                          如确认不再需要，可在 Supabase 控制台手动 DROP TABLE
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 缺失表 */ }
          {missing.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#E67E22]">
                ⚠️ 发现 {missing.length} 个缺失表（schema 有，DB 无）
              </h4>
              <div className="overflow-x-auto rounded-lg border border-[#E6F0F8]">
                <table className="w-full text-sm">
                  <thead className="bg-[#FFF9F0]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">模型名</th>
                      <th className="text-left px-3 py-2 font-medium">建议操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((m, idx) => (
                      <tr
                        key={`${m}-${idx}`}
                        className="border-t border-[#F0E8E0]"
                      >
                        <td className="px-3 py-2 font-mono text-[#E67E22]">
                          {m}
                        </td>
                        <td className="px-3 py-2 text-xs text-brand-text-muted">
                          请运行 `npm run db:push` 创建表
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 无问题 */ }
          {orphans.length === 0 && missing.length === 0 && (
            <div className="mt-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              ✅ 数据库表与 Prisma schema 完全一致，未发现野表或缺失表。
            </div>
          )}

          {/* DB 表总数 */ }
          <div className="text-xs mt-2 text-brand-text-muted">
            数据库 public schema 共有 {dbTables.length} 张表（不含系统表）
          </div>
        </div>
      )}

      {/* 初始状态提示 */ }
      {!loading && orphans.length === 0 && missing.length === 0 && dbTables.length === 0 && !error && (
        <div className="mt-3 text-sm text-brand-text-muted">
          点击「检测野表」开始扫描
        </div>
      )}
    </div>
  );
}
