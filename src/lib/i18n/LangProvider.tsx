"use client";

/**
 * 语言 Context Provider（客户端）。
 * - 初始语言由服务端通过 initialLang 注入（来自 cookie），避免水合 mismatch。
 * - 切换时写 cookie + router.refresh()，让 Server Component 也跟着换语言。
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LANG, LANG_COOKIE, type Lang } from "./config";
import { dict, type DictKey } from "./dict";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** 客户端取词（依赖 context 中的 lang）。支持可选变量替换。 */
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? DEFAULT_LANG);
  const router = useRouter();

  // 服务端语言（cookie）变化后同步到客户端状态
  useEffect(() => {
    if (initialLang) setLangState(initialLang);
  }, [initialLang]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      try {
        document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
      } catch {
        /* cookie 不可写时仅内存切换 */
      }
      router.refresh();
    },
    [router],
  );

  const toggle = useCallback(
    () => setLang(lang === "cn" ? "en" : "cn"),
    [lang, setLang],
  );

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => {
      const template = dict[key][lang];
      if (!vars) return template;
      return Object.entries(vars).reduce<string>(
        (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
        template,
      );
    },
    [lang],
  );

  return (
    <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>
  );
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) {
    // 兜底：极少数在 Provider 外使用时，回退到默认语言（不应出现在正常渲染路径）
    const fallback: LangCtx = {
      lang: DEFAULT_LANG,
      setLang: () => {},
      toggle: () => {},
      t: (key, vars) => {
        const template = dict[key][DEFAULT_LANG];
        if (!vars) return template;
        return Object.entries(vars).reduce<string>(
          (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
          template,
        );
      },
    };
    return fallback;
  }
  return c;
}
