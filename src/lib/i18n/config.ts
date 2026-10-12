/**
 * 语言配置 — 全站本地化（部分）
 *
 * 固定 UI 元素（导航、页脚、按钮、品牌名）按语言切换；
 * 用户生成内容（游戏简介、成员昵称、仅中文名的游戏名）永不改动。
 */
export type Lang = "cn" | "en";

export const LANG_COOKIE = "locale";
export const DEFAULT_LANG: Lang = "cn";

export function isValidLang(v: string | undefined | null): v is Lang {
  return v === "cn" || v === "en";
}
