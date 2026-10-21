"use client";

/**
 * 语言切换 — 顶栏图标位，仅显示即将切到的双字母代码（EN / CN）。
 */
import { useLang } from "@/lib/i18n/LangProvider";

export default function LangToggle() {
  const { lang, toggle } = useLang();
  const title = lang === "cn" ? "切换到 English" : "切换到 中文";

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-white hover:bg-white/10 transition-colors select-none"
    >
      <span className="relative h-5 w-[1.75rem] overflow-hidden" aria-hidden>
        <span
          className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold tracking-wide leading-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            lang === "cn" ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          }`}
        >
          EN
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold tracking-wide leading-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            lang === "en" ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
        >
          CN
        </span>
      </span>
    </button>
  );
}
