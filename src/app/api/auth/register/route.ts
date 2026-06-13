/**
 * 注册 API
 * POST /api/auth/register
 * Body: { email, password, name, inviteCode? }
 * 流程：验证输入 → 验证邀请码 → 生成验证码 → 存待验证数据到 VerificationToken → 发送邮件
 * 注意：此时不创建 User，等邮箱验证通过后再创建
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email/send";
import crypto from "crypto";
import { isRateLimited, getRateLimitRemaining } from "@/lib/utils/rate-limit";

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

    // 1. 检查邮箱是否已被已验证用户占用
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { emailVerified: true },
    });

    if (existingUser?.emailVerified) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 409 }
      );
    }
    // 脏数据清理：如果存在未验证的 User（旧逻辑残留），删掉
    if (existingUser && !existingUser.emailVerified) {
      await prisma.user.delete({ where: { email: normalizedEmail } });
    }

    // 2. 验证邀请码
    let assignedRole: string | undefined;
    if (inviteCode?.trim()) {
      const inviteCodeRecord = await prisma.inviteCode.findUnique({
        where: { code: inviteCode.trim().toUpperCase() },
      });
      const now = new Date();
      const expired = inviteCodeRecord?.expiresAt && inviteCodeRecord.expiresAt < now;
      const exhausted = inviteCodeRecord?.maxUses !== null
        && inviteCodeRecord != null
        && inviteCodeRecord.usedCount >= (inviteCodeRecord.maxUses ?? 0);

      if (!inviteCodeRecord || !inviteCodeRecord.isActive || expired || exhausted) {
        return NextResponse.json(
          { error: "邀请码无效、已过期或已达使用上限" },
          { status: 400 }
        );
      }

      await prisma.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: { usedCount: { increment: 1 } },
      });
      assignedRole = inviteCodeRecord.role;
    }

    // 3. 速率限制：同一邮箱 60 秒内只能发一次验证码
    const rateKey = `email:verify:${normalizedEmail}`;
    const limited = await isRateLimited(rateKey, 60, 1);
    if (limited) {
      const remaining = await getRateLimitRemaining(rateKey);
      return NextResponse.json(
        { error: `验证码发送过于频繁，请 ${remaining} 秒后再试` },
        { status: 429 }
      );
    }

    // 4. 生成验证码 + 密码哈希
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟有效
    const passwordHash = await hashPassword(password);

    // 5. 删除旧 token，存新 token（含待验证注册数据）
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      }),
      prisma.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token: code,
          expires: expiresAt,
          name,
          passwordHash,
          role: assignedRole ?? null,
        },
      }),
    ]);

    // 6. 发送验证邮件
    const emailSent = await sendVerificationEmail(normalizedEmail, code);

    return NextResponse.json(
      {
        verification: {
          sent: emailSent,
          // 仅开发环境：邮件发送失败时返回验证码方便调试
          ...(process.env.NODE_ENV !== "production" && !emailSent
            ? { code, expiresAt: expiresAt.toISOString() }
            : {}),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", (error as Error)?.message ?? error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
