/**
 * 审计上下文 — 使用 AsyncLocalStorage 在请求链路中传递操作用户和 IP
 *
 * 用法：
 *   API Route 中:
 *     const ip = getClientIp(request);
 *     auditContext.run({ userId: session.user.id, ipAddress: ip }, async () => {
 *       // Prisma 操作将自动记录审计日志，含 userId + ipAddress
 *     });
 *
 *   注意：目前仅 auth.ts 中的 login attempt 会设置上下文；
 *   其他 API 路由暂未包裹，审计日志的 userId 和 ipAddress 将为空。
 */
import { AsyncLocalStorage } from "async_hooks";

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
