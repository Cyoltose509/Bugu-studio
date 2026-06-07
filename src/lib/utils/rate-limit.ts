/**
 * 速率限制实现
 * 基于内存（单实例）或 Redis（多实例）
 * 生产多实例部署时切换到 Redis
 */

import { NextRequest } from "next/server";

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
