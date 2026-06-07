/**
 * Auth 错误页面
 */

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  Configuration: "服务器配置错误，请联系管理员",
  AccessDenied: "访问被拒绝",
  Verification: "验证失败，链接可能已过期",
  CredentialsSignin: "邮箱或密码错误",
  Default: "认证过程中发生错误",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-white mb-2">出错了</h1>
        <p className="text-gray-400 text-sm mb-6">
          {errorMessages[error] || errorMessages.Default}
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          返回登录
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-gray-400">加载中...</div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
