/**
 * 自定义退出登录页面
 * NextAuth 默认页面简陋，这里替换为品牌一致的 UI
 */
"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignOutPage() {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-6">
          <img
            src="/images/logo.png"
            alt="布谷工作室"
            className="w-16 h-16 mx-auto rounded-xl"
          />
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: "#25547A" }}>
          退出登录
        </h1>
        <p className="text-sm mb-8" style={{ color: "#777" }}>
          确认要退出当前账号吗？
        </p>

        <div className="space-y-3">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90"
            style={{ background: "#C62828" }}
          >
            确认退出
          </button>

          <button
            onClick={() => router.back()}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors border"
            style={{ color: "#555", borderColor: "#D0DEE8" }}
          >
            返回上一页
          </button>
        </div>

        <p className="mt-8 text-xs" style={{ color: "#AAA" }}>
          <Link href="/" className="hover:underline" style={{ color: "#3388BB" }}>
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
