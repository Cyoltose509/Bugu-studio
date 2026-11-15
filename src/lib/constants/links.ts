import type { DictKey } from "@/lib/i18n/dict";

export interface LinkPreset {
  v: string;
  k?: DictKey;
}

export interface LinkGroup {
  id: string;
  k: DictKey;
  items: LinkPreset[];
}

export const LINK_GROUPS: LinkGroup[] = [
  {
    id: "games",
    k: "form.link.group.games",
    items: [
      { v: "Steam" },
      { v: "itch.io" },
    ],
  },
  {
    id: "pan",
    k: "form.link.group.pan",
    items: [
      { v: "百度网盘", k: "form.link.baidu" },
      { v: "蓝奏云", k: "form.link.lanzou" },
      { v: "Google Drive" },
      { v: "夸克网盘" },
      { v: "阿里云盘" },
    ],
  },
  {
    id: "code",
    k: "form.link.group.code",
    items: [
      { v: "GitHub" },
      { v: "Gitee" },
    ],
  },
  {
    id: "video",
    k: "form.link.group.video",
    items: [
      { v: "B站", k: "form.link.bilibili" },
      { v: "YouTube" },
    ],
  },
  {
    id: "website",
    k: "form.link.group.website",
    items: [
      { v: "游戏官方网站", k: "form.link.official" },
      { v: "个人网站", k: "form.link.personalSite" },
    ],
  },
];

/** 扁平化的所有预设列表（用于遍历或匹配） */
export const ALL_LINK_PRESETS: LinkPreset[] = LINK_GROUPS.flatMap((g) => g.items);

/** 快捷选择按钮中的核心预设 */
export const QUICK_SELECT_PRESETS: LinkPreset[] = [
  { v: "Steam" },
  { v: "itch.io" },
  { v: "百度网盘", k: "form.link.baidu" },
  { v: "蓝奏云", k: "form.link.lanzou" },
  { v: "GitHub" },
  { v: "B站", k: "form.link.bilibili" },
  { v: "游戏官方网站", k: "form.link.official" },
];

/**
 * 判断某个链接是否属于网盘类链接
 */
export function isNetdiskLink(label: string, url?: string): boolean {
  const panLabels = ["百度网盘", "蓝奏云", "Google Drive", "夸克网盘", "阿里云盘", "123云盘"];
  if (panLabels.includes(label)) return true;
  if (/网盘|云盘|drive|disk|pan/i.test(label)) return true;
  if (url && /pan\.baidu\.com|yun\.baidu\.com|lanzou[a-z]?\.(com|cn)|woozooo\.com|drive\.google\.com|pan\.quark\.cn|alipan\.com|aliyundrive\.com|123pan\.com/i.test(url)) {
    return true;
  }
  return false;
}

/**
 * 从可能附带密码或提取码的网盘链接中解析出纯净 URL 与提取码
 */
export function extractNetdiskPassword(url?: string | null): { cleanUrl: string; password?: string } {
  if (!url) return { cleanUrl: "" };
  let str = url.trim();
  let password: string | undefined;

  // 1. 匹配类似 "提取码: abcd"、"密码: abcd"、"code: abcd" 等尾部文本
  const textMatch = str.match(/[\s,，;；|]+(?:提取码|密码|code|pwd)[:：\s]*([a-zA-Z0-9]{3,10})/i);
  if (textMatch) {
    password = textMatch[1];
    str = str.replace(textMatch[0], "").trim();
  }

  // 2. 匹配 URL 中的 query / hash 参数：?pwd=xxxx / &pwd=xxxx / #pwd=xxxx / ?code=xxxx
  const paramMatch = str.match(/[?&#](?:pwd|code)=([a-zA-Z0-9_-]+)/i);
  if (paramMatch) {
    if (!password) password = paramMatch[1];
    // 清理 URL，移除多余的 ?pwd= / #pwd=
    str = str.replace(paramMatch[0], "");
    // 清理遗留的无效符号（如 ?& 或尾部 ? / &）
    str = str.replace(/\?&/, "?").replace(/\?[#&]?$/, "").replace(/&#/, "#").trim();
  }

  return { cleanUrl: str, password };
}

/**
 * 组装网盘 URL 和密码，便于跳转和统一存储
 */
export function buildNetdiskUrl(rawUrl: string, password?: string): string {
  let url = rawUrl.trim();
  const pwd = password?.trim();
  if (!pwd) return url;

  // 如果已经包含 pwd= 或 code=，不再重复追加
  if (/[?&#](?:pwd|code)=/i.test(url)) return url;

  const joinChar = url.includes("?") ? "&" : "?";
  return `${url}${joinChar}pwd=${encodeURIComponent(pwd)}`;
}
