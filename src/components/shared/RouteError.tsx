"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Route Error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4" role="alert">
      <h2 className="text-2xl font-bold text-brand-text-heading mb-2">页面加载失败</h2>
      <p className="text-brand-text-secondary mb-6 text-center max-w-md">
        抱歉，页面在加载时遇到了问题。请稍后再试。
      </p>
      <button
        onClick={() => reset()}
        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
      >
        重新加载
      </button>
    </div>
  );
}
