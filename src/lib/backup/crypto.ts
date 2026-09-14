/**
 * 备份载荷加解密
 *
 * 为什么必须加密？
 * 现网图片走「公开可读」的 R2 桶。若把含 passwordHash 的 JSON
 * 明文放到同一桶（哪怕 key 是 admin-backups/...），知道 URL 的人就能拖走全站账号哈希。
 * 因此上传前用 AES-256-GCM 加密；密钥来自 BACKUP_ENCRYPTION_KEY，未配置则派生自 AUTH_SECRET。
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const MAGIC = "bugoo-backup-enc-v1";

export type EncryptedBackupBlob = {
  /** 固定魔数，便于识别与版本演进 */
  magic: typeof MAGIC;
  alg: "aes-256-gcm";
  /** 随机 IV（base64） */
  iv: string;
  /** GCM auth tag（base64） */
  tag: string;
  /** 密文（base64） */
  ciphertext: string;
};

function deriveKey(): Buffer {
  const explicit = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (explicit) {
    // 允许直接给 32 字节 hex，或任意口令（再哈希到 32 字节）
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
      return Buffer.from(explicit, "hex");
    }
    return createHash("sha256").update(`bugoo-backup-key:${explicit}`).digest();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "备份加密需要 AUTH_SECRET 或 BACKUP_ENCRYPTION_KEY。禁止上传未加密的数据库快照。"
    );
  }
  return createHash("sha256").update(`bugoo-backup-v1:${secret}`).digest();
}

/** 将 JSON 对象加密为可安全存入公开桶的结构 */
export function encryptBackupPayload(payload: unknown): EncryptedBackupBlob {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    magic: MAGIC,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

/** 解密；拒绝非本格式的明文 JSON，避免误把未加密文件当备份恢复 */
export function decryptBackupPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    throw new Error("备份文件格式无效");
  }

  const blob = raw as Partial<EncryptedBackupBlob>;
  if (blob.magic !== MAGIC || blob.alg !== "aes-256-gcm") {
    throw new Error(
      "该备份不是加密格式（或版本不支持）。旧的本地明文备份不能用于恢复；请重新「一键备份」。"
    );
  }
  if (!blob.iv || !blob.tag || !blob.ciphertext) {
    throw new Error("加密备份字段不完整");
  }

  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf-8"));
}

export function isEncryptedBackupBlob(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as EncryptedBackupBlob).magic === MAGIC
  );
}
