"use client";

/**
 * 键盘导航 Skip Link — 跳过导航直接到主内容区域
 * 聚焦时可见，提升键盘用户和无障碍体验
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999]
        focus:px-4 focus:py-2 focus:bg-[#E38043] focus:text-white focus:rounded-md
        focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#E38043] focus:ring-offset-2
        dark:focus:ring-offset-[#1a1f2e]"
    >
      跳到主要内容
    </a>
  );
}
