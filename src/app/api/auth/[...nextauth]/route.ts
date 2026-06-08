/**
 * Auth.js Route Handler
 * 处理 /api/auth/* 路由
 * 注意：必须用 Node.js runtime，因为 session 回调中有 Prisma 调用
 */

import { handlers } from "@/lib/auth/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
