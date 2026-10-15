/**
 * 监控页面访问令牌 — HMAC 签名 + 30 分钟过期
 */
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 30 * 60 * 1000; // 30 分钟

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 环境变量未设置，无法签发监控访问令牌");
  }
  return secret;
}

export function signMonitoringToken(): string {
  const secret = getSecret();
  const expiry = Date.now() + TTL_MS;
  const payload = String(expiry);
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${expiry}.${hmac}`;
}

export function verifyMonitoringToken(token: string): boolean {
  try {
    const [expiryStr, hmac] = token.split(".");
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;
    const expectedHmac = createHmac("sha256", getSecret()).update(expiryStr).digest("hex");
    // 常量时间比较防止时序攻击
    if (hmac.length !== expectedHmac.length) return false;
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}
