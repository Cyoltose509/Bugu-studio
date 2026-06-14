import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { createAuditLog, extractRequestInfo } from "@/lib/utils/audit";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return apiError("请先登录", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("请求体格式错误", 400);
  }

  const { currentPassword, newPassword, confirmPassword } = body as any;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return apiError("请填写所有密码字段", 400);
  }

  if (newPassword.length < 8) {
    return apiError("新密码长度至少为 8 位", 400);
  }

  if (newPassword !== confirmPassword) {
    return apiError("两次输入的新密码不一致", 400);
  }

  if (newPassword === currentPassword) {
    return apiError("新密码不能与当前密码相同", 400);
  }

  // 获取用户信息（含密码哈希）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  }) as any;

  if (!user || !user.passwordHash) {
    return apiError("账户异常，无法修改密码", 400);
  }

  // 验证当前密码
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return apiError("当前密码不正确", 400);
  }

  // 哈希新密码
  const hashed = await bcrypt.hash(newPassword, 12);

  // 更新密码
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashed },
  });

  // 审计日志
  const { ipAddress, userAgent } = extractRequestInfo(request);
  await createAuditLog({
    action: "UPDATE",
    userId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { field: "password" },
    ipAddress,
    userAgent,
    statusCode: 200,
  });

  return apiResponse({ success: true });
}
