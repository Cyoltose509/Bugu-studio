import { prisma } from "@/lib/db/prisma";
import { isMockDataEnabled, mockResolveActivityId } from "@/lib/mock/frontend-data";

/**
 * 活动详情路由 `/activities/[id]` 的参数历史上混用了两种值：
 * - cuid：列表页、管理后台链接（主流）
 * - slug：sitemap / @mention 通知等（曾导致 404）
 *
 * 这里统一解析成真实 Activity.id；找不到返回 null，由页面 notFound()。
 */
/**
 * 路由段里的中文 slug 拿到手仍是百分号编码（如 /activities/%E7%99%BE...），
 * 不解码就拿它去查 slug 必然查不到。这里最多解两层，解不动就用原值。
 */
function decodeKey(key: string): string {
  let out = key;
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9a-fA-F]{2}/.test(out)) break;
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out;
}

export async function resolveActivityId(key: string): Promise<string | null> {
  if (!key) return null;
  const raw = decodeKey(key);

  if (isMockDataEnabled()) {
    return mockResolveActivityId(raw);
  }

  try {
    const byId = await prisma.activity.findUnique({
      where: { id: raw },
      select: { id: true },
    });
    if (byId) return byId.id;

    // 解码后的值优先；若库里存的是编码形式（历史数据），再用原值兜一次
    const candidates = Array.from(new Set([raw, key].filter(Boolean)));
    for (const candidate of candidates) {
      const bySlug = await prisma.activity.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (bySlug) return bySlug.id;
    }
    return null;
  } catch {
    return mockResolveActivityId(raw);
  }
}
