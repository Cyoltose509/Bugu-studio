/**
 * 邮箱验证 API
 * POST /api/auth/verify
 * Body: { email, code }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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

    // 查找验证码
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

    // 标记邮箱已验证
    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: { emailVerified: new Date() },
      }),
      // 删除已使用的验证码
      prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
