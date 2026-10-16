/** 未读数服务端轻量缓存：减少重复 DB COUNT 查询 */

export type UnreadPayload = {
  count: number;
  review: number;
  activity: number;
  bug: number;
};

const serverCache = new Map<string, { data: UnreadPayload; ts: number }>();
const SERVER_CACHE_TTL = 5_000;

export function getCachedUnread(userId: string): UnreadPayload | null {
  const cached = serverCache.get(userId);
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCachedUnread(userId: string, data: UnreadPayload) {
  serverCache.set(userId, { data, ts: Date.now() });
}

export function invalidateUnreadCache(userId: string) {
  serverCache.delete(userId);
}
