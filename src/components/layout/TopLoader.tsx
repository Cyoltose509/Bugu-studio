"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * 顶部导航进度条
 *
 * 解决"点击后无反应"的核心认知问题：
 * - 全局监听 <a> 点击 → 立刻启动动画（用户立刻看到反馈）
 * - 导航完成（pathname 变化）→ 完成动画 → 消失
 * - 不依赖外部库，纯 CSS 动画，零性能开销
 */
export default function TopLoader() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const start = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    clearTimeout(timerRef.current);

    // 重置到 0 → 立即显示
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "1";
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    bar.offsetHeight; // force reflow

    // 缓动动画到 90%（8 秒 ≈ "正在加载"的体感）
    bar.style.transition = "width 8s cubic-bezier(0.1, 0.05, 0, 1)";
    bar.style.width = "90%";

    // 安全兜底：如果导航失败（如 JS 拦截），10 秒后自动隐藏
    timerRef.current = setTimeout(() => done(), 10_000);
  }, []);

  const done = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    clearTimeout(timerRef.current);

    // 快速冲到 100% → 淡出
    bar.style.transition = "width 0.2s ease-out, opacity 0.25s ease-out";
    bar.style.width = "100%";

    timerRef.current = setTimeout(() => {
      bar.style.opacity = "0";
      timerRef.current = setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 250);
    }, 150);
  }, []);

  // 全局捕获 <a> 点击 → 立刻启动进度条
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const link = el.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // 跳过外部链接、锚点、mailto、新窗口、下载
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
        return;
      }

      start();
    };

    document.addEventListener("click", handleClick, true); // capture phase
    return () => document.removeEventListener("click", handleClick, true);
  }, [start]);

  // 导航完成 → 结束动画
  useEffect(() => {
    done();
  }, [pathname, done]);

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 h-0.5 bg-brand-orange z-[9999] pointer-events-none"
      style={{ width: "0%", opacity: 0 }}
    />
  );
}
