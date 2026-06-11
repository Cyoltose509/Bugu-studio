/**
 * 邮箱验证 API
 * POST /api/auth/verify
 * Body: { email, code }
 * 流程：查找验证码 → 校验有效性 → 创建 User → 标记邮箱已验证 → 删除 token
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/services/notification";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "邮箱和验证码不能为空" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // 1. 查找验证 token（含待验证注册数据）
    const token = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: code,
        },
      },
    });

    if (!token || token.expires < new Date()) {
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 400 }
      );
    }

    // 2. 创建用户 + 清理 token（事务）
    const targetRole = token.role || "USER";
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: token.passwordHash!,
          name: token.name!,
          role: targetRole as any,
          emailVerified: new Date(),
        },
      }),
      prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      }),
    ]);

    // ── 通知所有管理员有新用户注册 ──
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", member: { isActive: true } },
      select: { id: true },
    });
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: "NEW_USER",
        title: "新用户注册",
        content: `${token.name}（${normalizedEmail}）刚刚完成注册，角色：${targetRole}`,
        relatedId: user.id,
        relatedType: "User",
      });
    }

    // 3. 如果邀请码赋予了 MEMBER 或 ADMIN 角色，自动创建 ClubMember 记录
    if (targetRole === "MEMBER" || targetRole === "ADMIN") {
      await prisma.clubMember.create({
        data: {
          userId: user.id,
          displayName: token.name!,
          joinYear: new Date().getFullYear(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
