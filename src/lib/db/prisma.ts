/**
 * Prisma Client 单例 + 全局审计中间件
 */

import { PrismaClient } from "@prisma/client";
import { auditContext } from "./audit-context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  auditPrisma: PrismaClient | undefined;
};

// ── 不审计的模型（内部/高频/无业务价值） ──
const SKIP_AUDIT_MODELS = new Set([
  "AuditLog",
  "Session",
  "VerificationToken",
  "Account",
  "LoginAttempt",
  "RateLimit",
  "ProjectLike",
  "Notification",
]);

// ── 只审计写操作 ──
const MUTATING_ACTIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * 用于写 AuditLog 的独立 PrismaClient（无中间件，避免循环）
 */
function getAuditPrisma(): PrismaClient {
  if (!globalForPrisma.auditPrisma) {
    globalForPrisma.auditPrisma = new PrismaClient({ log: [] });
  }
  return globalForPrisma.auditPrisma;
}

/** 从 params/result 中提取受影响的记录 ID */
function extractTargetId(params: any, result: any): string | undefined {
  if (result && typeof result === "object" && !Array.isArray(result) && "id" in result) {
    return String(result.id);
  }
  if (params.args?.where?.id) {
    return String(params.args.where.id);
  }
  return undefined;
}

/** 异步写入审计日志（fire-and-forget，含数据快照） */
async function writeAuditLog(
  action: string,
  model: string,
  targetId: string | undefined,
  userId: string | undefined,
  beforeData?: any,
  afterData?: any,
  metadata?: any
) {
  try {
    const ap = getAuditPrisma();
    await (ap as any).auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        targetType: model,
        targetId: targetId ?? null,
        beforeData: beforeData ? sanitize(beforeData) : undefined,
        afterData: afterData ? sanitize(afterData) : undefined,
        metadata: metadata ?? undefined,
        ipAddress: "system",
      },
    });
  } catch (e) {
    console.error("[Audit] write failed:", e);
  }
}

/** 去除大字段/二进制，避免审计日志膨胀 */
function sanitize(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) { cleaned[k] = v.toISOString(); continue; }
    if (k === "passwordHash") continue; // 绝不记录密码
    if (typeof v === "object" && v !== null) { cleaned[k] = sanitize(v); continue; }
    cleaned[k] = v;
  }
  return cleaned;
}

/** 读取当前记录（用于 UPDATE/DELETE 前捕获 beforeData） */
async function fetchCurrent(model: string, where: any): Promise<any> {
  try {
    const ap = getAuditPrisma();
    const record = await (ap as any)[model.charAt(0).toLowerCase() + model.slice(1)].findUnique({
      where: where.id ? { id: where.id } : where,
    });
    return record;
  } catch { return undefined; }
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: ["error"],
  });

  // ── 全局审计中间件 ──
  client.$use(async (params, next) => {
    const model = params.model;
    const action = params.action;

    if (!model || !MUTATING_ACTIONS.has(action) || SKIP_AUDIT_MODELS.has(model)) {
      return next(params);
    }

    // 捕获 beforeData（UPDATE/DELETE 前）
    let beforeData: any = undefined;
    if ((action === "update" || action === "updateMany" || action === "delete" || action === "deleteMany" || action === "upsert") && params.args?.where) {
      beforeData = await fetchCurrent(model!, params.args.where).catch(() => undefined);
    }

    const result = await next(params);

    // 异步写入审计日志（含数据快照）
    const ctx = auditContext.get();
    const targetId = extractTargetId(params, result);

    let metadata: any = {};
    if (action === "update" || action === "updateMany") {
      metadata.changedFields = params.args?.data ? Object.keys(params.args.data) : [];
    }

    setImmediate(() => {
      writeAuditLog(
        mapPrismaAction(action),
        model!,
        targetId,
        ctx.userId,
        action.startsWith("delete") ? beforeData : undefined,  // DELETE: 记录删除前数据
        action.startsWith("create") ? sanitize(result) : action === "update" || action === "upsert" ? sanitize(result) : undefined,  // CREATE: 新数据, UPDATE: 更新后数据
        metadata
      );
    });

    return result;
  });

  return client;
}

function mapPrismaAction(action: string): string {
  switch (action) {
    case "create":
    case "createMany":
      return "CREATE";
    case "update":
    case "updateMany":
    case "upsert":
      return "UPDATE";
    case "delete":
    case "deleteMany":
      return "DELETE";
    default:
      return "OTHER";
  }
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
