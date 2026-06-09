/** 未读数服务端轻量缓存：减少重复 DB COUNT 查询 */
const serverCache = new Map<string, { count: number; ts: number }>();
const SERVER_CACHE_TTL = 5_000; // 5 秒

export function getCachedUnread(userId: string): number | null {
  const cached = serverCache.get(userId);
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) {
    return cached.count;
  }
  return null;
}

export function setCachedUnread(userId: string, count: number) {
  serverCache.set(userId, { count, ts: Date.now() });
}

export function invalidateUnreadCache(userId: string) {
  serverCache.delete(userId);
}
