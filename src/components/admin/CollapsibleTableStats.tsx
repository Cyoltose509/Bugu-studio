"use client";

import { useState } from "react";

interface TableStat {
  table: string;
  size: string;
  rows: number;
}

interface Props {
  tableStats: TableStat[];
  dbSizeBytes: number;
}

const INITIAL_SHOW = 8;

/** 表空间占用表格 — 默认折叠，显示前 INITIAL_SHOW 项 */
export default function CollapsibleTableStats({ tableStats, dbSizeBytes }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? tableStats : tableStats.slice(0, INITIAL_SHOW);
  const hiddenCount = tableStats.length - INITIAL_SHOW;

  if (tableStats.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-brand-text-muted">
        暂无表数据
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-brand-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F0F5FA]">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-brand-text-body">表名</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-text-body">大小</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-text-body">行数</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((t, idx) => (
              <tr key={`${t.table}-${idx}`} className="border-t border-[#E6F0F8]">
                <td className="px-4 py-2.5 font-mono text-xs text-brand-text-heading">{t.table}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-brand-text-body">{t.size}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-brand-text-body">{t.rows.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div
                    className="h-1 rounded-full bg-[#3ECF8E] min-w-[4px] w-[var(--bar-width)]"
                    style={
                      {
                        "--bar-width": `${Math.min(100, dbSizeBytes > 0 ? (t.rows / Math.max(1, tableStats.reduce((s, x) => s + x.rows, 0))) * 100 * 5 : 0)}px`,
                      } as React.CSSProperties
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && !showAll && (
        <div className="text-center mt-2">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs px-4 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 border-brand-border-subtle text-brand-text-body"
          >
            展开全部 {tableStats.length} 张表 ▼
          </button>
        </div>
      )}

      {showAll && hiddenCount > 0 && (
        <div className="text-center mt-2">
          <button
            onClick={() => setShowAll(false)}
            className="text-xs px-4 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 border-brand-border-subtle text-brand-text-body"
          >
            收起 ▲
          </button>
        </div>
      )}
    </>
  );
}
