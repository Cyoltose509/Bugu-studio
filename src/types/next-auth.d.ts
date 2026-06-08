/**
 * Auth.js v5 类型扩展
 * 为 User、Session 等添加 role 字段
 *
 */
import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    isActive?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}
