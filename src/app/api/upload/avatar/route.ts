/**
 * /api/upload/avatar — 头像上传
 * 权限：登录用户（只能上传自己的头像）
 * 存储：优先 Cloudflare R2，未配置时降级到本地
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { uploadToR2 } from "@/lib/utils/upload";
import { isRateLimited, getRateLimitRemaining, resetRateLimit } from "@/lib/utils/rate-limit";
import sharp from "sharp";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "avatars");
const AVATAR_CHANGE_DAYS = 7;
const AVATAR_CHANGE_SECONDS = AVATAR_CHANGE_DAYS * 24 * 3600;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 速率限制：同一用户 7 天内只能更换一次头像
  const rateKey = `avatar:${session.user.id}`;
  const limited = await isRateLimited(rateKey, AVATAR_CHANGE_SECONDS, 1);
  if (limited) {
    const remaining = await getRateLimitRemaining(rateKey);
    const days = Math.ceil(remaining / 86400);
    return NextResponse.json(
      { error: `头像更换过于频繁，请 ${days} 天后再试` },
      { status: 429 }
    );
  }

  // 二次检查：读取数据库中的上次更换时间（防御性）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarChangedAt: true },
  });
  if (user?.avatarChangedAt) {
    const cooldownEnd = new Date(
      user.avatarChangedAt.getTime() + AVATAR_CHANGE_DAYS * 24 * 3600 * 1000
    );
    if (cooldownEnd > new Date()) {
      const remainingDays = Math.ceil(
        (cooldownEnd.getTime() - Date.now()) / (1000 * 86400)
      );
      // 清除速率限制记录（因为数据库层面已有限制，速率限制记录可能已过期）
      await resetRateLimit(rateKey);
      return NextResponse.json(
        { error: `头像更换过于频繁，请 ${remainingDays} 天后再试` },
        { status: 429 }
      );
    }
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "仅支持 JPG/PNG/WebP 格式" },
      { status: 400 }
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "文件大小不能超过 2MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 压缩头像到 64×64（PNG 格式，体积极小）
  const resizedBuffer = await sharp(buffer)
    .resize(64, 64, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
  const resizedMime = "image/png";
  const resizedName = file.name.replace(/\.[^.]+$/, ".png");

  let url: string;

  // R2 已配置时上传到 R2
  if (process.env.R2_ACCOUNT_ID && process.env.R2_PUBLIC_URL) {
    try {
      const result = await uploadToR2(resizedBuffer, resizedName, resizedMime, "avatar");
      url = result.url;
    } catch (err: any) {
      console.error("[avatar upload] R2 error:", err.message);
      return NextResponse.json({ error: "上传失败，请稍后重试" }, { status: 500 });
    }
  } else {
    // 降级：存本地
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${session.user.id}-${Date.now()}.png`;
    await writeFile(join(UPLOAD_DIR, filename), resizedBuffer);
    url = `/uploads/avatars/${filename}`;
  }

  // 更新用户头像 URL 和更换时间
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      image: url,
      avatarChangedAt: new Date(),
    },
  });

  // 同步更新 ClubMember.avatar（如果该用户有关联的成员记录）
  await prisma.clubMember.updateMany({
    where: { userId: session.user.id },
    data: { avatar: url },
  });

  // 重置速率限制（允许用户立即再次尝试如果本次上传失败的话）
  // 这里不清除，因为 7 天限制是严格的
  return NextResponse.json({ url });
}
