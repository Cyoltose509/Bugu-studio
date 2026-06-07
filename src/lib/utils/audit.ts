/**
 * 审计日志工具
 */

import { prisma } from "@/lib/db/prisma";
import type { AuditAction } from "@prisma/client";
import { NextRequest } from "next/server";

interface AuditLogData {
  action: AuditAction;
  userId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ipAddress: string;
  userAgent?: string;
  statusCode?: number;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        statusCode: data.statusCode,
      },
    });
  } catch (error) {
    // 审计日志失败不应影响主流程，但需记录错误
    console.error("[AuditLog] 写入失败:", error);
  }
}

/**
 * 从 NextRequest 提取审计信息
 */
export function extractRequestInfo(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || undefined,
  };
}
