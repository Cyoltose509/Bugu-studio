import { Suspense } from "react";
import ErrorReportsClient from "@/components/admin/ErrorReportsClient";

export default function AdminErrorsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold mb-6 text-brand-navy">前端错误</h1>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ErrorReportsClient />
    </Suspense>
  );
}
