/**
 * POST /api/admin/monitoring-password — 管理员设置/更改监控页第二道门锁
 *
 * - 仅 ADMIN
 * - 已配置时必须提交正确的 currentPassword，禁止仪表盘式「直接覆盖」
 * - 哈希存在 SiteSetting，响应不返回明文或哈希
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
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword.trim() : "";

  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "密码至少 8 位" }, { status: 400 });
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key: "monitoring_password" },
    select: { value: true },
  });

  if (existing) {
    if (!currentPassword) {
      return NextResponse.json({ ok: false, error: "请输入当前监控密码" }, { status: 400 });
    }
    const match = await bcrypt.compare(currentPassword, existing.value);
    if (!match) {
      return NextResponse.json({ ok: false, error: "当前监控密码不正确" }, { status: 403 });
    }
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
