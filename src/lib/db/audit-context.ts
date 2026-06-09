/**
 * 审计上下文 — 使用 AsyncLocalStorage 在请求链路中传递操作用户
 *
 * 用法：
 *   API Route 中: auditContext.run({ userId: session.user.id }, async () => { ... })
 *   Prisma 中间件自动读取当前 userId，写入 AuditLog
 */

import { AsyncLocalStorage } from "async_hooks";

interface AuditContextValue {
  userId?: string;
}

const storage = new AsyncLocalStorage<AuditContextValue>();

export const auditContext = {
  /** 获取当前请求上下文中存储的值 */
  get(): AuditContextValue {
    return storage.getStore() ?? {};
  },

  /** 在上下文中执行回调 */
  run<T>(ctx: AuditContextValue, fn: () => Promise<T>): Promise<T> {
    return storage.run(ctx, fn);
  },
};
