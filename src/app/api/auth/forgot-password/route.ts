/**
 * POST /api/auth/forgot-password — 申请密码重置
 * 无论邮箱是否存在都返回 200（防账户枚举）
 * 速率限制：同一邮箱 1 分钟 1 次
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { SITE_URL } from "@/lib/email/resend";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("请求体格式错误", 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("邮箱格式不正确", 422);
  }

  const { email } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // ── 速率限制：同一邮箱 1 分钟 1 次 ──
  const rateKey = `forgot-password:${normalizedEmail}`;
  const limited = await isRateLimited(rateKey, 60, 1);
  if (limited) {
    return apiResponse(
      { message: "如果该邮箱已注册，重置邮件已发送" },
    );
  }

  // ── 查找用户 ──
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, isActive: true },
  });

  // 用户不存在或已注销，静默返回（防枚举）
  if (!user?.isActive) {
    return apiResponse(
      { message: "如果该邮箱已注册，重置邮件已发送" },
    );
  }

  // ── 生成令牌（30 分钟有效） ──
  const token = randomUUID();
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  // 删除该邮箱的旧令牌
  await prisma.passwordResetToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  // 创建新令牌
  await prisma.passwordResetToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  });

  // ── 发送重置邮件 ──
  const resetUrl = `${SITE_URL}/auth/reset-password?token=${token}`;
  await sendPasswordResetEmail(normalizedEmail, resetUrl);

  return apiResponse(
    { message: "如果该邮箱已注册，重置邮件已发送" },
  );
}
