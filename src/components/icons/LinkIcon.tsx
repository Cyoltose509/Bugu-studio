import Image from "next/image";

/**
 * 外部/社交链接的小图标。
 *
 * 三种来源：
 * 1) 单色描边的品牌 SVG（GitHub 小猫）—— 用 currentColor 上色，明暗模式自适应；
 * 2) 站内已备的品牌图（Bilibili / Steam）—— 比 emoji 更还原；
 * 3) emoji 兜底表（知乎、小红书……），都没有时用中性链接符号。
 *
 * 注意标签写法不统一：编辑表单里给的是 "Bilibili"，而项目表单里存的是 "B站"，
 * 所以命中规则同时看标签关键字和 URL 域名，任一条匹配即可。
 */

/** 单色品牌图标：直接内联 SVG，颜色跟随文字（currentColor） */
const BRAND_SVG: { label: RegExp; url: RegExp; path: string }[] = [
  {
    label: /github/i,
    url: /github\.com|github\.io/i,
    path: "M512 42.666667A464.64 464.64 0 0 0 42.666667 502.186667 460.373333 460.373333 0 0 0 363.52 938.666667c23.466667 4.266667 32-9.813333 32-22.186667v-78.08c-130.56 27.733333-158.293333-61.44-158.293333-61.44a122.026667 122.026667 0 0 0-52.053334-67.413333c-42.666667-28.16 3.413333-27.733333 3.413334-27.733334a98.56 98.56 0 0 1 71.68 47.36 101.12 101.12 0 0 0 136.533333 37.973334 99.413333 99.413333 0 0 1 29.866667-61.44c-104.106667-11.52-213.333333-50.773333-213.333334-226.986667a177.066667 177.066667 0 0 1 47.36-124.16 161.28 161.28 0 0 1 4.693334-121.173333s39.68-12.373333 128 46.933333a455.68 455.68 0 0 1 234.666666 0c89.6-59.306667 128-46.933333 128-46.933333a161.28 161.28 0 0 1 4.693334 121.173333A177.066667 177.066667 0 0 1 810.666667 477.866667c0 176.64-110.08 215.466667-213.333334 226.986666a106.666667 106.666667 0 0 1 32 85.333334v125.866666c0 14.933333 8.533333 26.88 32 22.186667A460.8 460.8 0 0 0 981.333333 502.186667 464.64 464.64 0 0 0 512 42.666667",
  },
];

const IMAGE_RULES: { src: string; label: RegExp; url: RegExp }[] = [
  {
    src: "/images/links/bilibili.png",
    label: /bilibili|哔哩|b站/i,
    url: /bilibili\.com|b23\.tv|bili2233\.cn/i,
  },
  {
    src: "/images/links/steam.png",
    label: /steam/i,
    url: /steamcommunity\.com|steampowered\.com|s\.team/i,
  },
];

const EMOJI_RULES: { test: RegExp; icon: string }[] = [
  { test: /gitlab/i, icon: "🦊" },
  { test: /个人网站|官网|website|blog/i, icon: "🌐" },
  { test: /知乎/i, icon: "📝" },
  { test: /小红书/i, icon: "📕" },
  { test: /微博/i, icon: "📢" },
  { test: /抖音|tiktok/i, icon: "🎵" },
  { test: /csdn/i, icon: "📋" },
  { test: /掘金/i, icon: "💎" },
  { test: /itch/i, icon: "🕹️" },
  { test: /网盘|drive|disk|pan/i, icon: "📁" },
];

/** 命中的单色品牌 SVG（path 数据）；没有则返回 null */
export function linkBrandSvg(label: string, url?: string | null): string | null {
  for (const rule of BRAND_SVG) {
    if (rule.label.test(label || "") || (url ? rule.url.test(url) : false)) return rule.path;
  }
  return null;
}

/** 命中的品牌图片路径；没有则返回 null */
export function linkImageSrc(label: string, url?: string | null): string | null {
  for (const rule of IMAGE_RULES) {
    if (rule.label.test(label || "") || (url ? rule.url.test(url) : false)) return rule.src;
  }
  return null;
}

/** emoji 兜底 */
export function linkEmoji(label: string): string {
  for (const rule of EMOJI_RULES) {
    if (rule.test.test(label || "")) return rule.icon;
  }
  return "🔗";
}

export default function LinkIcon({
  label,
  url,
  size = 16,
  className = "",
}: {
  label: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const glyph = linkBrandSvg(label, url);
  const src = linkImageSrc(label, url);

  if (glyph) {
    return (
      <svg
        viewBox="0 0 1024 1024"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="currentColor"
        aria-hidden
      >
        <path d={glyph} />
      </svg>
    );
  }

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 leading-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.92) }}
      aria-hidden
    >
      {linkEmoji(label)}
    </span>
  );
}
