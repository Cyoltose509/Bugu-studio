"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Profile edit 页面的 SessionProvider 包装
 * 只有这个页面需要 useSession()，避免全局引入 200KB next-auth 客户端代码
 */
export default function ProfileEditLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
