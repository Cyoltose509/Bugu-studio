/**
 * POST /api/auth/redeem-invite — 兑换邀请码升级身份
 * 已登录用户使用邀请码转换为 MEMBER 或 ADMIN 角色
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { inviteCode } = await request.json().catch(() => ({}));

  if (!inviteCode?.trim()) {
    return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
  }

  const code = await prisma.inviteCode.findUnique({
    where: { code: inviteCode.trim().toUpperCase() },
  });

  if (!code || !code.isActive) {
    return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
  }

  if (code.expiresAt && code.expiresAt < new Date()) {
    return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
  }

  if (code.maxUses && code.usedCount >= code.maxUses) {
    return NextResponse.json({ error: "邀请码已达使用上限" }, { status: 400 });
  }

  const targetRole = code.role as "USER" | "MEMBER" | "ADMIN";

  // 不允许降级（已经是更高级别的角色）
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const roleHierarchy: Record<string, number> = { USER: 0, MEMBER: 1, ADMIN: 2, GUEST: -1 };
  if ((roleHierarchy[currentUser!.role] ?? 0) >= (roleHierarchy[targetRole] ?? 0)) {
    return NextResponse.json(
      { error: `你当前的 ${currentUser!.role === 'ADMIN' ? '管理员' : currentUser!.role === 'MEMBER' ? '社团成员' : '普通用户'} 身份已等于或高于邀请码等级` },
      { status: 400 }
    );
  }

  // 使用邀请码
  await prisma.inviteCode.update({
    where: { id: code.id },
    data: { usedCount: { increment: 1 } },
  });

  // 更新用户角色
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: targetRole },
  });

  // 如果升级为 MEMBER 或 ADMIN，同步创建 ClubMember 记录
  if (targetRole === "MEMBER" || targetRole === "ADMIN") {
    const existingMember = await prisma.clubMember.findUnique({
      where: { userId: session.user.id },
    });
    if (!existingMember) {
      await prisma.clubMember.create({
        data: {
          userId: session.user.id,
          displayName: session.user.name ?? "新成员",
          joinYear: new Date().getFullYear(),
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    role: targetRole,
    message:
      targetRole === "ADMIN"
        ? "已升级为管理员"
        : "已升级为社团成员",
  });
}
