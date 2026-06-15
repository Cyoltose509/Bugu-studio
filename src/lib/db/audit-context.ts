/**
 * 审计上下文 — 使用 AsyncLocalStorage 在请求链路中传递操作用户和 IP
 *
 * 机制：
 *   1. middleware 在 Edge Runtime 将 x-audit-user-id / x-audit-ip 写入响应头
 *   2. withAuditContext() 包装器读取请求头中的审计信息，注入 AsyncLocalStorage
 *   3. Prisma 中间件从 AsyncLocalStorage 读取，写入 AuditLog
 *
 * 用法：
 *   import { withAuditContext } from "@/lib/db/audit-context";
 *   export const GET = withAuditContext(async (req) => { ... });
 *   export const POST = withAuditContext(async (req) => { ... });
 */
import { AsyncLocalStorage } from "async_hooks";
import { NextRequest } from "next/server";

interface AuditContextValue {
  userId?: string;
  ipAddress?: string;
}

const storage = new AsyncLocalStorage<AuditContextValue>();

export const auditContext = {
  get(): AuditContextValue {
    return storage.getStore() ?? {};
  },
  run<T>(ctx: AuditContextValue, fn: () => Promise<T>): Promise<T> {
    return storage.run(ctx, fn);
  },
};

/**
 * API Route 处理器包装器 — 自动从 middleware 注入的请求头中提取用户和 IP，
 * 并注入到 AsyncLocalStorage，确保 Prisma 审计中间件能获取到正确信息。
 */
type ApiHandler = (
  req: NextRequest,
  context?: any
) => Promise<Response>;

export function withAuditContext(handler: ApiHandler): ApiHandler {
  return (req, context) => {
    const userId = req.headers.get("x-audit-user-id") || undefined;
    const ipAddress = req.headers.get("x-audit-ip") || undefined;

    return storage.run({ userId, ipAddress }, () => handler(req, context));
  };
}

/**
 * Server Action 辅助 — 从 cookies 中读取审计信息并执行
 * 用于那些不经过 API route 的 Server Action
 */
export async function runWithAuditFromHeaders<T>(
  req: NextRequest | Request,
  fn: () => Promise<T>
): Promise<T> {
  let userId: string | undefined;
  let ipAddress: string | undefined;

  if (req instanceof NextRequest || "headers" in req) {
    const headers = req.headers;
    userId = headers.get("x-audit-user-id") || undefined;
    ipAddress = headers.get("x-audit-ip") || undefined;
  }

  return storage.run({ userId, ipAddress }, fn);
}
