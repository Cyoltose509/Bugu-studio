/**
 * 错误报告管理页面
 */
import { Suspense } from "react";
import ErrorReportsClient from "@/components/admin/ErrorReportsClient";

export default function ErrorReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold mb-6 text-brand-navy dark:text-[#8db8d8]">🔥 前端错误报告</h1>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-[#1e2438] animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ErrorReportsClient />
    </Suspense>
  );
}
