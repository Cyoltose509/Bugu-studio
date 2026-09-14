/**
 * 管理端数据库备份存取（Cloudflare R2）
 *
 * Key 约定：admin-backups/v{version}.json.gz
 * 对象内容：gzip(加密后的 JSON)，不是明文库表。
 *
 * 注意：业务图床与备份共用 R2 桶时，桶往往对公网可读。
 * 因此禁止上传明文快照；见 crypto.ts。
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { gzipSync, gunzipSync } from "zlib";
import { decryptBackupPayload, encryptBackupPayload } from "./crypto";

const PREFIX = "admin-backups";

function requireR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 未配置完整，无法读写云端备份（需要 R2_ACCOUNT_ID / R2_BUCKET_NAME / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）"
    );
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

function getClient() {
  const { accountId, accessKeyId, secretAccessKey } = requireR2();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export function backupObjectKey(version: number): string {
  return `${PREFIX}/v${version}.json.gz`;
}

/** 加密 → gzip → 上传。返回对象 key 与压缩后字节数。 */
export async function uploadBackupPayload(
  version: number,
  payload: unknown
): Promise<{ key: string; bytes: number }> {
  const { bucket } = requireR2();
  const key = backupObjectKey(version);
  const encrypted = encryptBackupPayload(payload);
  const body = gzipSync(Buffer.from(JSON.stringify(encrypted), "utf-8"));
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
      // 明确标注：即使桶公开，对象仍是密文
      Metadata: {
        "backup-version": String(version),
        "backup-time": new Date().toISOString(),
        encrypted: "aes-256-gcm",
      },
    })
  );
  return { key, bytes: body.byteLength };
}

/** 下载 → gunzip → 解密，得到原始 BackupBundle */
export async function downloadBackupPayload(version: number): Promise<unknown> {
  const { bucket } = requireR2();
  const key = backupObjectKey(version);
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`备份文件为空: ${key}`);
  const outer = JSON.parse(gunzipSync(Buffer.from(bytes)).toString("utf-8"));
  return decryptBackupPayload(outer);
}

export async function backupExists(version: number): Promise<boolean> {
  try {
    const { bucket } = requireR2();
    const client = getClient();
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: backupObjectKey(version),
      })
    );
    return true;
  } catch {
    return false;
  }
}
