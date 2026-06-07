/**
 * 文件上传 API
 * POST /api/upload - 上传图片到 R2
 * 允许: jpg, png, webp
 * MIME 检查 + Magic Bytes 双重验证
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import {
  uploadToR2,
  validateImageMagicBytes,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  type UploadType,
} from "@/lib/utils/upload";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { createAuditLog, extractRequestInfo } from "@/lib/utils/audit";
import { apiResponse, apiError } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const ip = getClientIp(request);
  const rl = checkRateLimit(
    `upload:${session.user.id}`,
    RATE_LIMITS.UPLOAD
  );
  if (!rl.allowed) return apiError("上传过于频繁，请稍后再试", 429);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("无效的表单数据", 400);
  }

  const file = formData.get("file") as File | null;
  const uploadType = (formData.get("type") as string) || "screenshot";

  if (!file) return apiError("未找到文件", 400);

  // 验证上传类型
  const validTypes: UploadType[] = ["avatar", "cover", "screenshot"];
  if (!validTypes.includes(uploadType as UploadType)) {
    return apiError("无效的上传类型", 400);
  }

  // 验证 MIME 类型（不信任 Content-Type，需要 Magic Bytes 验证）
  const mimeType = file.type;
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    return apiError("仅支持 JPG、PNG、WebP 格式", 400);
  }

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic Bytes 验证（防止扩展名欺骗）
  if (!validateImageMagicBytes(buffer)) {
    await createAuditLog({
      action: "SUSPICIOUS_REQUEST",
      userId: session.user.id,
      metadata: {
        reason: "magic_bytes_mismatch",
        declaredType: mimeType,
        fileName: file.name,
      },
      ...extractRequestInfo(request),
    });
    return apiError("文件内容与声明类型不符", 400);
  }

  // 上传到 R2
  let result;
  try {
    result = await uploadToR2(
      buffer,
      file.name,
      mimeType,
      uploadType as UploadType
    );
  } catch (error: any) {
    return apiError(error.message || "上传失败", 500);
  }

  // 审计日志
  await createAuditLog({
    action: "FILE_UPLOAD",
    userId: session.user.id,
    metadata: {
      uploadType,
      fileSize: buffer.length,
      mimeType,
      key: result.key,
    },
    ...extractRequestInfo(request),
    statusCode: 201,
  });

  return apiResponse({ url: result.url, key: result.key }, 201);
}

// 禁止其他 HTTP 方法
export async function GET() {
  return apiError("方法不允许", 405);
}
