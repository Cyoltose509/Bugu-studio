/**
 * /api/upload — 通用图片上传（截图/历史事件图片等）
 * 权限：登录用户
 * 存储：优先 Cloudflare R2，未配置时降级到本地
 */

import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { uploadToR2 } from "@/lib/utils/upload";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "screenshots");

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
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

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "文件大小不能超过 8MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let url: string;

  // R2 已配置时上传到 R2
  if (process.env.R2_ACCOUNT_ID && process.env.R2_PUBLIC_URL) {
    try {
      const result = await uploadToR2(buffer, file.name, file.type, "screenshot");
      url = result.url;
    } catch (err: any) {
      console.error("[upload] R2 error:", err.message);
      return NextResponse.json({ error: "上传失败，请稍后重试" }, { status: 500 });
    }
  } else {
    // 降级：存本地
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.user.id}-${Date.now()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), buffer);
    url = `/uploads/screenshots/${filename}`;
  }

  return NextResponse.json({ url });
}
