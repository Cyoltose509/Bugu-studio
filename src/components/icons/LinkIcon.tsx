import Image from "@/components/ui/SiteImage";

/**
 * 外部/社交链接的小图标。
 *
 * 来源：
 * 1) 站内已备的品牌图/favicon（Bilibili、Steam、itch.io、百度网盘、蓝奏云、Google Drive、夸克、阿里云盘、Gitee）—— 最真实还原；
 * 2) 单色描边的品牌 SVG（GitHub、YouTube、游戏官网、个人网站）—— 用 currentColor 上色，明暗模式自适应；
 * 3) emoji 兜底表（知乎、小红书……），都没有时用中性链接符号。
 */

/** 单色品牌图标：直接内联 SVG，颜色跟随文字（currentColor），viewBox 均为 0 0 1024 1024 */
const BRAND_SVG: { label: RegExp; url: RegExp; path: string; viewBox?: string }[] = [
  {
    label: /github/i,
    url: /github\.com|github\.io/i,
    path: "M512 42.666667A464.64 464.64 0 0 0 42.666667 502.186667 460.373333 460.373333 0 0 0 363.52 938.666667c23.466667 4.266667 32-9.813333 32-22.186667v-78.08c-130.56 27.733333-158.293333-61.44-158.293333-61.44a122.026667 122.026667 0 0 0-52.053334-67.413333c-42.666667-28.16 3.413333-27.733333 3.413334-27.733334a98.56 98.56 0 0 1 71.68 47.36 101.12 101.12 0 0 0 136.533333 37.973334 99.413333 99.413333 0 0 1 29.866667-61.44c-104.106667-11.52-213.333333-50.773333-213.333334-226.986667a177.066667 177.066667 0 0 1 47.36-124.16 161.28 161.28 0 0 1 4.693334-121.173333s39.68-12.373333 128 46.933333a455.68 455.68 0 0 1 234.666666 0c89.6-59.306667 128-46.933333 128-46.933333a161.28 161.28 0 0 1 4.693334 121.173333A177.066667 177.066667 0 0 1 810.666667 477.866667c0 176.64-110.08 215.466667-213.333334 226.986666a106.666667 106.666667 0 0 1 32 85.333334v125.866666c0 14.933333 8.533333 26.88 32 22.186667A460.8 460.8 0 0 0 981.333333 502.186667 464.64 464.64 0 0 0 512 42.666667",
  },
  {
    label: /youtube/i,
    url: /youtube\.com|youtu\.be/i,
    path: "M806.4 316.8a102.4 102.4 0 0 0-72-72.4C670.8 227.6 512 227.6 512 227.6s-158.8 0-222.4 16.8a102.4 102.4 0 0 0-72 72.4C200.8 380.4 200.8 512 200.8 512s0 131.6 16.8 195.2a102.4 102.4 0 0 0 72 72.4c63.6 16.8 222.4 16.8 222.4 16.8s158.8 0 222.4-16.8a102.4 102.4 0 0 0 72-72.4c16.8-63.6 16.8-195.2 16.8-195.2s0-131.6-16.8-195.2zM448 624V400l192 112-192 112z",
  },
  {
    label: /游戏官方网站|游戏官网|official/i,
    url: /official/i,
    viewBox: "0 0 24 24",
    path: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V18a2 2 0 0 0-2-2h-1a1 1 0 0 1-1-1v-1a2 2 0 0 0-2-2H6.07a8 8 0 0 1 12.87-2.93l-.94.93a2 2 0 0 0-.6 1.41V13a2 2 0 0 0 2 2h.4a8 8 0 0 1-6.8 4.93z",
  },
  {
    label: /个人网站|个人主页|博客|blog/i,
    url: /blog/i,
    viewBox: "0 0 24 24",
    path: "M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z",
  },
];

const IMAGE_RULES: { src: string; label: RegExp; url: RegExp }[] = [
  {
    src: "/images/links/itch-favicon.ico",
    label: /itch/i,
    url: /itch\.io/i,
  },
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
  {
    src: "/images/links/baidu-netdisk.svg",
    label: /百度网盘|百度云|baidu/i,
    url: /pan\.baidu\.com|yun\.baidu\.com/i,
  },
  {
    src: "/images/links/lanzou.ico",
    label: /蓝奏云|蓝奏|lanzou/i,
    url: /lanzou[a-z]?\.(com|cn)|woozooo\.com/i,
  },
  {
    src: "/images/links/googledrive.svg",
    label: /google drive|谷歌网盘|gdrive/i,
    url: /drive\.google\.com/i,
  },
  {
    src: "/images/links/quark.ico",
    label: /夸克/i,
    url: /pan\.quark\.cn/i,
  },
  {
    src: "/images/links/alipan.ico",
    label: /阿里/i,
    url: /alipan\.com|aliyundrive\.com/i,
  },
  {
    src: "/images/links/gitee.ico",
    label: /gitee|码云/i,
    url: /gitee\.com/i,
  },
];

const EMOJI_RULES: { test: RegExp; icon: string }[] = [
  { test: /gitlab/i, icon: "🦊" },
  { test: /知乎/i, icon: "📝" },
  { test: /小红书/i, icon: "📕" },
  { test: /微博/i, icon: "📢" },
  { test: /抖音|tiktok/i, icon: "🎵" },
  { test: /csdn/i, icon: "📋" },
  { test: /掘金/i, icon: "💎" },
  { test: /网盘|drive|disk|pan/i, icon: "📁" },
];

/** 命中的单色品牌 SVG（path 与 viewBox）；没有则返回 null */
export function linkBrandSvg(label: string, url?: string | null): { path: string; viewBox?: string } | null {
  for (const rule of BRAND_SVG) {
    if (rule.label.test(label || "") || (url ? rule.url.test(url) : false)) {
      return { path: rule.path, viewBox: rule.viewBox || "0 0 1024 1024" };
    }
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
  const brand = linkBrandSvg(label, url);
  const src = linkImageSrc(label, url);

  if (src) {
    if (src.endsWith(".ico") || src.endsWith(".svg")) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
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

  if (brand) {
    return (
      <svg
        viewBox={brand.viewBox}
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="currentColor"
        aria-hidden
      >
        <path d={brand.path} />
      </svg>
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
