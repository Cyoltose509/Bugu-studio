/**
 * POST /api/admin/monitoring-password — 管理员设置/重置监控页第二道门锁密码
 *
 * 设计说明：
 * - 监控密码存在 SiteSetting（bcrypt），不在环境变量明文里
 * - 调用方必须已是 ADMIN（能进 /admin），因此允许「不知道旧密码」直接重置，方便交接
 * - 响应不返回哈希或明文密码
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "密码至少 8 位" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.siteSetting.upsert({
    where: { key: "monitoring_password" },
    create: { key: "monitoring_password", value: hash },
    update: { value: hash },
  });

  return NextResponse.json({ ok: true, message: "监控密码已更新" });
}

/** GET — 是否已配置监控密码（不返回哈希或明文） */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const setting = await prisma.siteSetting.findUnique({
    where: { key: "monitoring_password" },
    select: { key: true },
  });

  return NextResponse.json({ ok: true, configured: !!setting });
}
