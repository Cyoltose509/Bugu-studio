/**
 * POST /api/admin/compress-avatars — 批量压缩所有用户头像到 64×64
 * 仅管理员可调用
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { uploadToR2, deleteFromR2 } from "@/lib/utils/upload";
import sharp from "sharp";

export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
  }

  // 查找所有有头像的用户
  const users = await prisma.user.findMany({
    where: {
      image: { not: null },
    },
    select: { id: true, name: true, image: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: "没有需要处理的头像", total: 0 });
  }

  const results: { id: string; name: string | null; status: string; oldSize?: number; newSize?: number }[] = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_PUBLIC_URL && process.env.R2_BUCKET_NAME);

  for (const user of users) {
    try {
      if (!user.image) continue;

      // 下载原始头像
      const fetchRes = await fetch(user.image, {
        signal: AbortSignal.timeout(15000),
      });

      if (!fetchRes.ok) {
        results.push({ id: user.id, name: user.name, status: `下载失败 HTTP ${fetchRes.status}` });
        failCount++;
        continue;
      }

      const oldBuffer = Buffer.from(await fetchRes.arrayBuffer());
      const oldSize = oldBuffer.length;

      // 如果已经很小了（< 10KB 64×64 PNG 通常 3-6KB），跳过
      if (oldSize < 4096) {
        results.push({ id: user.id, name: user.name, status: "已足够小，跳过", oldSize });
        skipCount++;
        continue;
      }

      // sharp 压缩到 64×64
      const newBuffer = await sharp(oldBuffer)
        .resize(64, 64, { fit: "cover", position: "center" })
        .png()
        .toBuffer();
      const newSize = newBuffer.length;

      if (hasR2) {
        // 上传到 R2（新文件，不覆盖旧的）
        const uploadResult = await uploadToR2(
          newBuffer,
          `avatar-${user.id}.png`,
          "image/png",
          "avatar"
        );

        // 更新用户头像 URL
        await prisma.user.update({
          where: { id: user.id },
          data: { image: uploadResult.url },
        });

        // 同步 ClubMember
        await prisma.clubMember.updateMany({
          where: { userId: user.id },
          data: { avatar: uploadResult.url },
        });

        // ── 清理旧头像（best-effort）──
        if (user.image) {
          deleteFromR2(user.image).catch(() => {});
        }
      } else {
        // 本地存储：写入新文件
        const { writeFile, mkdir } = await import("fs/promises");
        const { join } = await import("path");
        const dir = join(process.cwd(), "public", "uploads", "avatars");
        await mkdir(dir, { recursive: true });
        const filename = `${user.id}-compressed-${Date.now()}.png`;
        await writeFile(join(dir, filename), newBuffer);
        const localUrl = `/uploads/avatars/${filename}`;

        await prisma.user.update({
          where: { id: user.id },
          data: { image: localUrl },
        });
        await prisma.clubMember.updateMany({
          where: { userId: user.id },
          data: { avatar: localUrl },
        });
      }

      results.push({
        id: user.id,
        name: user.name,
        status: "成功",
        oldSize,
        newSize,
      });
      successCount++;
    } catch (err: any) {
      results.push({
        id: user.id,
        name: user.name,
        status: `异常: ${err.message?.slice(0, 80) || "未知错误"}`,
      });
      failCount++;
    }
  }

  return NextResponse.json({
    total: users.length,
    success: successCount,
    skipped: skipCount,
    failed: failCount,
    results,
  });
}
