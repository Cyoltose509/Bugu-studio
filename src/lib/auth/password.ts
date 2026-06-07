/**
 * 密码工具 - 使用 scrypt（Node.js 内置）
 * 符合 OWASP 2024 推荐参数
 * 无需额外原生依赖，兼容 Next.js 构建
 */

import { scrypt, randomBytes, timingSafeEqual } from "crypto";

// OWASP 推荐 scrypt 参数
const SCRYPT_N = 16384; // CPU/内存消耗 (2^14)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64; // 输出密钥长度（字节）

/**
 * 哈希密码（scrypt）
 * 输出格式：scrypt:<salt_hex>:<derived_key_hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * 验证密码
 * 支持 scrypt 格式和 legacy argon2 格式（自动拒绝未迁移的旧哈希）
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash || storedHash === "CHANGE_IMMEDIATELY") return false;

  try {
    if (storedHash.startsWith("scrypt:")) {
      return verifyPasswordScrypt(password, storedHash);
    }
    // 不兼容 argon2 格式——要求用户重置密码
    if (storedHash.startsWith("$argon2")) {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

async function verifyPasswordScrypt(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [, salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });

  const storedKey = Buffer.from(hash, "hex");
  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
