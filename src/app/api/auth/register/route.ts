/**
 * 注册 API
 * POST /api/auth/register
 * Body: { email, password, name, inviteCode? }
 * 流程：验证邀请码 → 创建用户 → 生成验证码 → 发送验证邮件 → 返回成功
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email/send";
import crypto from "crypto";
import { isRateLimited, resetRateLimit } from "@/lib/utils/rateLimit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "输入数据无效" },
        { status: 400 }
      );
    }

    const { email, password, name, inviteCode } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // 检查邮箱是否已注册
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // 已验证用户 → 拒绝
      if (existing.emailVerified) {
        return NextResponse.json(
          { error: "该邮箱已被注册" },
          { status: 409 }
        );
      }
      // 未验证 → 删除旧记录，允许重新注册
      await prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // 检查邀请码
    let assignedRole: string | undefined;
    if (inviteCode?.trim()) {
      const inviteCodeRecord = await prisma.inviteCode.findUnique({
        where: { code: inviteCode.trim().toUpperCase() },
      });
      const now = new Date();
      const expired = inviteCodeRecord?.expiresAt && inviteCodeRecord.expiresAt < now;
      const exhausted = inviteCodeRecord?.maxUses !== null && inviteCodeRecord != null && inviteCodeRecord.usedCount >= (inviteCodeRecord.maxUses ?? 0);

      if (!inviteCodeRecord || !inviteCodeRecord.isActive || expired || exhausted) {
        return NextResponse.json(
          { error: "邀请码无效、已过期或已达使用上限" },
          { status: 400 }
        );
      }

      // 使用邀请码
      await prisma.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: { usedCount: { increment: 1 } },
      });
      assignedRole = inviteCodeRecord.role;
    }

    // 创建用户（未验证邮箱）
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        role: assignedRole ? (assignedRole as any) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // 速率限制：同一邮箱 60 秒内只能发送一次验证码
    const rateKey = `email:verify:${normalizedEmail}`;
    const limited = await isRateLimited(rateKey, 60, 1);
    if (limited) {
      const remaining = await getRateLimitRemaining(rateKey);
      return NextResponse.json(
        { error: `验证码发送过于频繁，请 ${remaining} 秒后再试` },
        { status: 429 }
      );
    }

    // 生成 6 位验证码
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟有效

    // 存储验证码到 VerificationToken 表
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: code,
        expires: expiresAt,
      },
    });

    // 发送验证邮件（未配置 Resend 时优雅跳过）
    const emailSent = await sendVerificationEmail(normalizedEmail, code);

    return NextResponse.json({
      user,
      verification: {
        sent: emailSent,
        // 开发模式：未配置 Resend 时返回验证码方便调试
        ...(emailSent ? {} : { code, expiresAt: expiresAt.toISOString() }),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
