/**
 * 速率限制工具
 * 用于限制邮箱验证码发送频率、头像更换频率等
 * 使用 Prisma + RateLimit 表实现，支持 Vercel 无状态部署
 */

import { prisma } from "@/lib/db/prisma";

/**
 * 检查是否超出速率限制
 * @param key   唯一键，如 "email:verify:user@test.com" 或 "avatar:userId"
 * @param windowSeconds 时间窗口（秒）
 * @param maxCount     时间窗口内最大允许次数（默认 1）
 * @returns true = 被限流（不允许操作），false = 允许操作
 */
export async function isRateLimited(
  key: string,
  windowSeconds: number,
  maxCount = 1
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // 清理过期记录（顺带清理，保持表苗条）
  await prisma.rateLimit
    .deleteMany({
      where: { expiresAt: { lt: now } },
    })
    .catch(() => {});

  // 查找当前窗口内的记录
  const record = await prisma.rateLimit.findUnique({
    where: { key },
  });

  if (!record) {
    // 没有记录，允许操作，创建新记录
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    await prisma.rateLimit.create({
      data: { key, count: 1, expiresAt },
    });
    return false; // 未限流
  }

  // 记录已过期（防御性检查）
  if (record.expiresAt < now) {
    await prisma.rateLimit.delete({ where: { key } });
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    await prisma.rateLimit.create({
      data: { key, count: 1, expiresAt },
    });
    return false;
  }

  // 在窗口期内，检查次数
  if (record.count >= maxCount) {
    return true; // 已限流
  }

  // 未超限，增加计数
  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return false;
}

/**
 * 获取速率限制的剩余冷却时间（秒）
 * 用于向前端返回还有多久可以再次操作
 */
export async function getRateLimitRemaining(
  key: string
): Promise<number> {
  const record = await prisma.rateLimit.findUnique({
    where: { key },
  });
  if (!record) return 0;
  const remaining = Math.ceil(
    (record.expiresAt.getTime() - Date.now()) / 1000
  );
  return Math.max(0, remaining);
}

/**
 * 重置某个 key 的速率限制（操作后手动清除，如验证成功）
 */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit
    .delete({ where: { key } })
    .catch(() => {});
}
