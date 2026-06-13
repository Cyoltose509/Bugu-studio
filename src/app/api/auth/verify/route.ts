/**
 * 邮箱验证 API
 * POST /api/auth/verify
 * Body: { email, code }
 * 流程：查找验证码 → 校验有效性 → 创建 User → 标记邮箱已验证 → 删除 token
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/services/notification";
import { invalidateCache } from "@/lib/db/cache";
import { checkBlocked, isRateLimited, resetRateLimit } from "@/lib/utils/rate-limit";
import { verifyCodeSchema } from "@/lib/validations";

const VERIFY_RATE_WINDOW = 15 * 60; // 15 分钟
const VERIFY_RATE_MAX = 5; // 最多 5 次失败

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "输入数据无效" },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;

    const normalizedEmail = email.toLowerCase();
    const rateKey = `verify:fail:${normalizedEmail}`;

    // ── 暴力破解保护：检查是否已被锁定 ──
    const isLocked = await checkBlocked(rateKey, VERIFY_RATE_WINDOW, VERIFY_RATE_MAX);
    if (isLocked) {
      return NextResponse.json(
        { error: "验证码尝试次数过多，请 15 分钟后再试" },
        { status: 429 }
      );
    }

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
      // 计入失败次数
      await isRateLimited(rateKey, VERIFY_RATE_WINDOW, VERIFY_RATE_MAX).catch(() => {});
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 400 }
      );
    }

    // 2. 创建用户 + 清理 token（事务）
    // 安全：邀请码角色最高到 MEMBER，禁止直接赋予 ADMIN
    const rawRole = (token.role || "USER") as string;
    const targetRole = rawRole === "ADMIN" ? "MEMBER" : rawRole;
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
      where: { role: "ADMIN", member: { graduated: false } },
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
      await invalidateCache("members:all");
    }

    // 验证成功 → 清除失败计数
    await resetRateLimit(rateKey).catch(() => {});

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
    console.error("Verify error:", (error as Error)?.message ?? error);
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
