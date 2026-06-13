/**
 * /api/upload — 通用图片上传（截图/历史事件图片等）
 * 权限：登录用户
 * 存储：Cloudflare R2（生产）/ 本地降级（缺 R2 配置时）
 */

import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/utils/upload";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 上传速率限制
  const rl = checkRateLimit(`upload:${session.user.id}`, RATE_LIMITS.UPLOAD);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `上传过于频繁，请 ${Math.ceil(rl.resetAt.getTime() / 1000 - Date.now() / 1000)} 秒后再试` },
      { status: 429 }
    );
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

  // ── 检查 R2 配置 ──
  const missing: string[] = [];
  if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
  if (!process.env.R2_PUBLIC_URL) missing.push("R2_PUBLIC_URL");

  if (missing.length > 0) {
    console.error("[upload] R2 not configured, missing:", missing.join(", "));
    return NextResponse.json(
      { error: "上传服务暂不可用" },
      { status: 500 }
    );
  }

  try {
    const result = await uploadToR2(buffer, file.name, file.type, "screenshot");
    return NextResponse.json({ url: result.url });
  } catch (err: any) {
    console.error("[upload] R2 error:", err.message ?? err);
    return NextResponse.json(
      { error: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
