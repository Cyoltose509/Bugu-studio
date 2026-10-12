"use client";

/**
 * 语言切换按钮 — 昼夜切换按钮左侧。
 * 显示「点击后将切换到的语言」（中文页显示 EN，英文页显示 CN），点击切换。
 * 用 globe 图标 + 两字母代码，放大为胶囊按钮，与 ThemeToggle 在父级 items-center 下对齐。
 */
import { useLang } from "@/lib/i18n/LangProvider";

function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3z" />
    </svg>
  );
}

export default function LangToggle() {
  const { lang, toggle } = useLang();
  // 显示目标语言：中文页 → EN，英文页 → CN
  const target = lang === "cn" ? "EN" : "CN";
  const title = lang === "cn" ? "切换到 English" : "切换到 中文";

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors select-none"
    >
      <GlobeIcon size={16} />
      <span className="text-xs font-semibold tracking-wide leading-none">{target}</span>
    </button>
  );
}
