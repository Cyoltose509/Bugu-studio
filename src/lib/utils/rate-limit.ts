/**
 * 速率限制 — 统一实现
 *
 * checkRateLimit / getClientIp / RATE_LIMITS → 内存（IP 级别限流）
 * isRateLimited / getRateLimitRemaining / resetRateLimit → Prisma（用户级别限流）
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 内存存储（单实例适用）
const store = new Map<string, RateLimitEntry>();

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(store.keys());
  for (const key of keys) {
    const entry = store.get(key)!;
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000); // 每分钟清理一次

interface RateLimitOptions {
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
  /** 标识前缀 */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * 检查速率限制
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const { windowSeconds, maxRequests, prefix = "rl" } = options;
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(entry.resetAt),
    };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * 从请求获取客户端 IP
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ============================================================
// 预定义速率限制配置
// ============================================================

export const RATE_LIMITS = {
  /** 登录接口 - 每 IP 每 15 分钟 10 次 */
  LOGIN: { windowSeconds: 900, maxRequests: 10, prefix: "login" },

  /** 注册接口 - 每 IP 每小时 5 次 */
  REGISTER: { windowSeconds: 3600, maxRequests: 5, prefix: "register" },

  /** API 通用 - 每 IP 每分钟 60 次 */
  API_GENERAL: { windowSeconds: 60, maxRequests: 60, prefix: "api" },

  /** 文件上传 - 每用户每小时 20 次 */
  UPLOAD: { windowSeconds: 3600, maxRequests: 20, prefix: "upload" },

  /** 搜索 - 每 IP 每分钟 30 次 */
  SEARCH: { windowSeconds: 60, maxRequests: 30, prefix: "search" },
} as const;

/* ── Prisma-based 用户级限流（用于邮箱验证码、头像更换等） ── */

/**
 * 检查是否超出速率限制（基于数据库，无状态部署友好）
 * @returns true = 被限流，false = 允许
 */
export async function isRateLimited(key: string, windowSeconds: number, maxCount = 1): Promise<boolean> {
  const now = new Date();

  await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  if (!record || record.expiresAt < now) {
    if (record) await prisma.rateLimit.delete({ where: { key } }).catch(() => {});
    await prisma.rateLimit.create({ data: { key, count: 1, expiresAt: new Date(now.getTime() + windowSeconds * 1000) } });
    return false;
  }

  if (record.count >= maxCount) return true;

  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return false;
}

export async function getRateLimitRemaining(key: string): Promise<number> {
  const record = await prisma.rateLimit.findUnique({ where: { key } });
  if (!record) return 0;
  return Math.max(0, Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000));
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.delete({ where: { key } }).catch(() => {});
}
