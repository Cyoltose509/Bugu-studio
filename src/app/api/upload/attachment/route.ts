/**
 * /api/upload/attachment — 公开课资料附件
 * 权限：管理员
 * 存储：Cloudflare R2 attachments/
 */

import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { uploadAttachmentToR2, MAX_FILE_SIZE, attachmentContentType } from "@/lib/utils/upload";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: session?.user ? 403 : 401 });
  }

  const rl = checkRateLimit(`upload:${session.user.id}`, RATE_LIMITS.UPLOAD);
  if (!rl.allowed) {
    return NextResponse.json({ error: "上传过于频繁，请稍后再试" }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }
  if (!attachmentContentType(file.name)) {
    return NextResponse.json({ error: "仅支持 PDF、Office、ZIP、TXT、Markdown 和图片" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE.screenshot) {
    return NextResponse.json({ error: `文件需小于 ${Math.floor(MAX_FILE_SIZE.screenshot / 1024 / 1024)}MB` }, { status: 400 });
  }

  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
    .filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("[attachment upload] R2 not configured, missing:", missing.join(", "));
    return NextResponse.json({ error: "上传服务暂不可用" }, { status: 500 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAttachmentToR2(buffer, file.name);
    return NextResponse.json({
      url: result.url,
      name: result.name,
      mimeType: result.mimeType,
      sizeBytes: buffer.length,
    });
  } catch (err: unknown) {
    console.error("[attachment upload] R2 error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
