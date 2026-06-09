/**
 * API Route 审计包装器
 *
 * 用法 (API Route):
 *   import { withAudit } from "@/lib/db/with-audit";
 *   export const POST = withAudit(async (req) => { ... });
 *
 * 用法 (Server Action):
 *   import { runWithAudit } from "@/lib/db/with-audit";
 *   const result = await runWithAudit(session.user.id, async () => { ... });
 */

import { auth } from "@/lib/auth/auth";
import { auditContext } from "./audit-context";
import { NextRequest, NextResponse } from "next/server";

type ApiHandler = (req: NextRequest, ...args: any[]) => Promise<NextResponse>;

/**
 * 包装 API Route Handler，自动注入当前用户到审计上下文
 */
export function withAudit(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, ...args: any[]) => {
    const session = await auth();

    return auditContext.run(
      { userId: session?.user?.id },
      () => handler(req, ...args)
    );
  };
}

/**
 * 在指定用户上下文中执行操作（用于 Server Actions 或需要覆盖用户的场景）
 */
export async function runWithAudit<T>(
  userId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return auditContext.run({ userId }, fn);
}
