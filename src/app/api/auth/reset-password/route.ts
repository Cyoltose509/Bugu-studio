/**
 * POST /api/auth/reset-password — 执行密码重置
 * 验证令牌 → 更新密码 → 删除令牌
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { resetPasswordSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("请求体格式错误", 400);
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    // 提取第一条有意义的错误信息
    const firstKey = Object.keys(issues)[0] as keyof typeof issues;
    const firstMsg = firstKey ? issues[firstKey]?.[0] : "数据验证失败";
    return apiError(firstMsg || "数据验证失败", 422);
  }

  const { token, password } = parsed.data;

  // ── 查找令牌 ──
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    // 令牌过期或不存在的也删掉
    if (resetToken) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    }
    return apiError("重置链接已过期或无效，请重新申请", 400);
  }

  // ── 查找用户 ──
  const user = await prisma.user.findUnique({
    where: { email: resetToken.identifier },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    return apiError("该账号不存在或已被注销", 400);
  }

  // ── 事务：更新密码 + 删除令牌 ──
  const hashedPassword = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);

  return apiResponse({ message: "密码重置成功，请使用新密码登录" });
}
