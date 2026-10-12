import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isValidLang, type Lang } from "./config";

/**
 * 服务端读取当前语言（来自 cookie）。
 * 用于 Server Component 直接渲染对应语言，避免水合不匹配。
 */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isValidLang(v) ? v : DEFAULT_LANG;
}
