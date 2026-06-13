/**
 * Cloudflare R2 文件上传工具
 * 使用 AWS SDK v3（R2 兼容 S3 API）
 *
 * 依赖: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { extname } from "path";

// 允许上传的图片类型
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// 文件大小限制
export const MAX_FILE_SIZE = {
  avatar: 2 * 1024 * 1024,    // 2MB
  cover: 5 * 1024 * 1024,     // 5MB
  screenshot: 8 * 1024 * 1024, // 8MB
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
