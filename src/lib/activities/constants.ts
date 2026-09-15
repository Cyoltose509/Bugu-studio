/** 活动线下地点默认值与预设选项 */
export const DEFAULT_ACTIVITY_LOCATION = "总图书馆未来学习中心";

export const ACTIVITY_LOCATION_PRESETS = [
  DEFAULT_ACTIVITY_LOCATION,
] as const;

/** 未上传封面时使用的默认图（例会等无封面时回退） */
export const DEFAULT_ACTIVITY_COVER = "/images/default_pic.png";

/** 从 BV 号或 B 站链接中解析出 BV id（如 BV1xx…） */
export function parseBvId(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const fromUrl = raw.match(/bilibili\.com\/video\/(BV[\w]+)/i);
  if (fromUrl) return fromUrl[1];
  const bare = raw.match(/^(BV[\w]+)$/i);
  if (bare) return bare[1];
  const loose = raw.match(/(BV[\w]+)/i);
  return loose ? loose[1] : null;
}

export function bilibiliWatchUrl(bvId: string): string {
  return `https://www.bilibili.com/video/${bvId}`;
}
