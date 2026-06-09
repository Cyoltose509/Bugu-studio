/**
 * 数据库查询缓存层
 * 支持：Upstash Redis（生产）/ 内存缓存（开发/降级）
 *
 * 用法：
 *   const data = await cachedQuery('home:stats', () => getStats(), 300);
 */

import { Redis } from '@upstash/redis';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const keyRegistry = new Set<string>(); // 追踪所有设置的缓存 key
const CACHE_TTL = 30_000;

// ── Upstash Redis（生产） ──────────────────────
// 在 Vercel 中设置环境变量：
//   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=xxx
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }
  return null;
}

// ── 内存缓存（开发/降级） ──────────────────────

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function memSet<T>(key: string, data: T, ttl: number): void {
  memCache.set(key, { data, expiry: Date.now() + ttl });
}

// ── 统一接口 ────────────────────────────────────

export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  const r = getRedis();
  const ttlMs = ttlSeconds * 1000;

  // 1. 尝试从缓存读取
  if (r) {
    try {
      const cached = await r.get<string>(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis 失败，降级到内存
    }
  } else {
    const cached = memGet<T>(key);
    if (cached !== null) return cached;
  }

  // 2. 缓存未命中，执行查询
  const data = await queryFn();

  // 3. 写入缓存
  if (r) {
    try {
      await r.set(key, JSON.stringify(data), { ex: ttlSeconds });
      keyRegistry.add(key);
    } catch { /* ignore */ }
  } else {
    memSet(key, data, ttlMs);
    keyRegistry.add(key);
  }

  return data;
}

/** 使某个前缀的所有缓存失效 */
export async function invalidateCache(prefix: string): Promise<void> {
  const r = getRedis();
  const matchingKeys = Array.from(keyRegistry).filter(k => k.startsWith(prefix));
  
  if (r && matchingKeys.length > 0) {
    try {
      // 批量删除匹配的 Redis key
      await Promise.all(matchingKeys.map(k => r!.del(k)));
    } catch { /* ignore */ }
  }
  
  // 清理内存缓存和注册表
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
  for (const key of matchingKeys) {
    keyRegistry.delete(key);
  }
}
