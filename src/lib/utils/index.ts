/**
 * 通用工具函数
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成 URL 友好的 slug
 */
export function generateSlug(title: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\-]/g, "") // 只保留英文字母、数字、下划线、连字符
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "") // 去头尾连字符
    .trim();

  // 纯中文标题清理后为空，用随机后缀兜底
  if (!cleaned) return `project-${Math.random().toString(36).slice(2, 8)}`;
  return cleaned;
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "未知";
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 分页计算
 */
export function getPagination(page: number, pageSize: number) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const take = pageSize;
  return { skip, take };
}

/**
 * 安全的 JSON 响应
 */
export function apiResponse<T>(
  data: T,
  status = 200
): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(
  message: string,
  status = 400,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
