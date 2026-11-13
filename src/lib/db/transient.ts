/**
 * 数据库瞬时错误识别 —— 纯函数
 *
 * Supabase Pooler（pgbouncer）在高峰期会断开空闲连接、拒绝新建连接，Prisma 侧表现
 * 为一串"看起来像业务错误、其实重试一次就成功"的异常：
 * - P1001 Can't reach database server
 * - P1017 Server has closed the connection
 * - Timed out fetching a new connection from the connection pool
 * - Transaction API error: Transaction not found（事务被池化层回收）
 * - 底层 socket 的 ECONNRESET / ETIMEDOUT / EPIPE / ENOTFOUND
 *
 * RSC 里这些异常一旦抛出就会让整页变成 "An error occurred in the Server Components render"，
 * 而实际上 200~300ms 后重试就能成功。这里只负责识别，是否重试由调用方决定。
 */

/** Prisma 已知的可重试错误码（连接层，不涉及约束冲突 / 语法错误） */
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

/** 消息特征（Prisma 原生错误、pooler 提示、底层 socket 错误） */
const RETRYABLE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /can'?t reach database server/i,
  /server has closed the connection/i,
  /connection (?:closed|terminated|reset)/i,
  /timed out fetching a new connection/i,
  /transaction (?:api )?error:?\s*transaction not found/i,
  /transaction already closed/i,
  /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN)\b/,
];

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  name?: unknown;
}

/** 从任意抛出值里安全取出 message / code */
function describe(error: unknown): { message: string; code: string } {
  if (typeof error === "string") return { message: error, code: "" };
  if (error && typeof error === "object") {
    const candidate = error as ErrorLike;
    const message = typeof candidate.message === "string" ? candidate.message : "";
    const code = typeof candidate.code === "string" ? candidate.code : "";
    return { message, code };
  }
  return { message: "", code: "" };
}

/**
 * 是否为「重试一次就可能成功」的数据库连接层错误。
 *
 * 约束冲突（P2002）、记录不存在（P2025）、SQL 语法错误等**不**在此列 —— 重试没有意义。
 */
export function isTransientDbError(error: unknown): boolean {
  const { message, code } = describe(error);
  if (code && RETRYABLE_PRISMA_CODES.has(code)) return true;
  const haystack = message || "";
  if (!haystack) return false;
  return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(haystack));
}

/** 默认重试前的等待时间（毫秒）；数组长度即重试次数 */
export const DEFAULT_DB_RETRY_DELAYS_MS: readonly number[] = [200];

/**
 * 执行一次数据库查询，遇到连接层瞬时错误时按 delays 依次重试。
 * 非瞬时错误立即抛出，不做无意义的重试。
 */
export async function withDbRetry<T>(
  queryFn: () => Promise<T>,
  delaysMs: readonly number[] = DEFAULT_DB_RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      // 最后一次尝试失败，或不是可重试的瞬时错误 → 直接抛出
      if (attempt === delaysMs.length || !isTransientDbError(error)) break;
      await sleep(delaysMs[attempt]);
    }
  }
  throw lastError;
}
