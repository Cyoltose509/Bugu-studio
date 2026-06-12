/**
 * POST /api/admin/verify-monitoring
 * 验证监控页面访问密码，成功后设置签名 cookie
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signMonitoringToken } from "@/lib/monitoring-token";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ ok: false, error: "请输入密码" }, { status: 400 });
    }

    // 从数据库读取加密密码
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "monitoring_password" },
    });

    if (!setting) {
      return NextResponse.json(
        { ok: false, error: "系统未配置监控密码，请联系管理员" },
        { status: 500 }
      );
    }

    const valid = await bcrypt.compare(password, setting.value);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "密码错误" }, { status: 401 });
    }

    // 密码正确 — 签发签名令牌
    const token = signMonitoringToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set("monitoring_access", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 60, // 30 分钟
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("verify-monitoring error:", err);
    return NextResponse.json({ ok: false, error: "服务器内部错误" }, { status: 500 });
  }
}
