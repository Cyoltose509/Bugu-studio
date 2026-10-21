/**
 * Cloudflare R2 文件上传工具
 * 使用 AWS SDK v3（R2 兼容 S3 API）
 *
 * 依赖: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { extname } from "path";
import { UPLOAD_LIMIT_BYTES, AVATAR_LIMIT_BYTES } from "./uploadLimits";

// 允许上传的图片类型
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * 文件大小限制
 *
 * 注意：站点部署在 Vercel，Serverless Function 的请求体有硬上限（实测
 * 4,491,679 字节，详见 ./uploadLimits.ts）。超过后请求根本到不了这里
 * （Vercel 直接返回纯文本 413），所以这里的数字写更大没有意义，只会让报错骗人。
 *
 * 必须与客户端共用同一份常量：之前这里写 4MB 而客户端压到 4.2MB 以内，
 * 落在 4.0~4.2MB 的图会被这里以「超出限制」拒掉，属于自己打自己。
 */
export const MAX_FILE_SIZE = {
  avatar: AVATAR_LIMIT_BYTES,
  cover: UPLOAD_LIMIT_BYTES,
  screenshot: UPLOAD_LIMIT_BYTES,
} as const;

export type UploadType = keyof typeof MAX_FILE_SIZE;

// R2 客户端（单例）
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return r2Client;
}

export interface UploadResult {
  url: string;      // 公开访问 URL
  key: string;      // R2 对象 Key
}

/**
 * 上传文件到 R2
 * @param file - File 对象或 Buffer
 * @param type - 上传类型（影响大小限制和目录）
 * @param mimeType - MIME 类型（需预先验证）
 * @returns 上传结果
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  type: UploadType
): Promise<UploadResult> {
  // 验证 MIME 类型
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    throw new Error(`不允许的文件类型: ${mimeType}`);
  }

  // 验证文件扩展名
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`不允许的文件扩展名: ${ext}`);
  }

  // 验证文件大小
  if (buffer.length > MAX_FILE_SIZE[type]) {
    throw new Error(
      `文件大小超出限制 (最大 ${MAX_FILE_SIZE[type] / 1024 / 1024}MB)`
    );
  }

  // 生成随机文件名（防止路径遍历和覆盖攻击）
  const randomName = randomBytes(16).toString("hex");
  const key = `${type}s/${randomName}${ext}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // 元数据（不存原始文件名，防止信息泄露）
      Metadata: {
        "upload-type": type,
        "upload-time": new Date().toISOString(),
      },
    })
  );

  const url = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { url, key };
}

const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** 公开课资料。扩展名决定类型，避免只信浏览器上报的 MIME。 */
export function attachmentContentType(originalName: string): { ext: string; mimeType: string } | null {
  const ext = extname(originalName).toLowerCase();
  const mimeType = ATTACHMENT_MIME_BY_EXT[ext];
  if (!mimeType) return null;
  return { ext, mimeType };
}

export function attachmentStorageName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() || "附件";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return cleaned || "附件";
}

/** 上传公开课附件。对象名随机，展示名由调用方另存。 */
export async function uploadAttachmentToR2(buffer: Buffer, originalName: string): Promise<UploadResult & { mimeType: string; name: string }> {
  const typed = attachmentContentType(originalName);
  if (!typed) throw new Error("不支持的附件类型");
  if (buffer.length <= 0 || buffer.length > MAX_FILE_SIZE.screenshot) {
    throw new Error(`文件大小超出限制 (最大 ${Math.floor(MAX_FILE_SIZE.screenshot / 1024 / 1024)}MB)`);
  }
  const name = attachmentStorageName(originalName);
  const key = `attachments/${randomBytes(16).toString("hex")}${typed.ext}`;
  const asciiName = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "") || "file";
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: typed.mimeType,
      ContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      Metadata: {
        "upload-type": "attachment",
        "upload-time": new Date().toISOString(),
      },
    })
  );
  const url = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { url, key, mimeType: typed.mimeType, name };
}

/**
 * 从 R2 删除文件（best-effort，静默失败）
 * @param urlOrKey - 完整 URL 或 R2 key
 * @returns 是否删除成功
 */
export async function deleteFromR2(urlOrKey: string): Promise<boolean> {
  if (!urlOrKey) return false;

  // R2 未配置则跳过
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    return false;
  }

  // 从 URL 提取 key，或直接使用 key
  let key = urlOrKey;
  if (urlOrKey.startsWith("http")) {
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
    if (publicUrl && urlOrKey.startsWith(publicUrl)) {
      key = urlOrKey.slice(publicUrl.length + 1); // +1 for the "/"
    } else {
      // 尝试匹配 avatars/、covers/、screenshots/ 路径
      const match = urlOrKey.match(/\/((?:avatars|covers|screenshots|attachments)\/[^?#]+)/)
        || urlOrKey.match(/\/((?:avatar|covers?|screenshot)s?\/[^?#]+)/);
      if (match) {
        key = match[1];
      } else {
        console.warn("[R2 delete] Cannot extract key from URL:", urlOrKey);
        return false;
      }
    }
  }

  // 安全校验：key 必须以 avatars/、covers/、screenshots/ 开头
  if (!/^(avatars|covers|screenshots|attachments)\//.test(key)) {
    console.warn("[R2 delete] Refusing to delete key outside allowed prefixes:", key);
    return false;
  }

  try {
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      })
    );
    return true;
  } catch (err: any) {
    console.error(`[R2 delete] Failed to delete "${key}":`, err.message);
    return false;
  }
}

/**
 * 批量删除 R2 文件（并行、静默失败）
 * @param urls - 要删除的 URL 或 key 数组
 */
export async function deleteManyFromR2(urls: (string | null | undefined)[]): Promise<{ deleted: number; failed: number }> {
  const validUrls = urls.filter(Boolean) as string[];
  if (validUrls.length === 0) return { deleted: 0, failed: 0 };

  const results = await Promise.allSettled(
    validUrls.map((u) => deleteFromR2(u))
  );

  const deleted = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.filter((r) => r.status === "rejected" || !r.value).length;
  return { deleted, failed };
}
