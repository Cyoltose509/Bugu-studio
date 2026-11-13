"use client";

import { useEffect, useRef } from "react";
import { attemptTransientRecovery, isRecoverableTransientError } from "@/lib/utils/transient-error";

/**
 * 全局瞬态错误自愈器 —— 挂在根布局，渲染 null（不占视觉）
 *
 * 监听 window 的 error（capture）与 unhandledrejection，命中以下情况时自动刷新一次：
 * - 旧 chunk 404（部署后客户端仍引用旧 chunk 文件，Webpack 抛 ChunkLoadError）；
 * - <script src> 资源加载失败（/_next/static/chunks/ 下的脚本请求 404 / 网络错误）；
 * - RSC 流中断 / 网络抖动（"Connection closed." / "Failed to fetch" 等）。
 * 刷新频率上限、冷却与离线判断统一交给 attemptTransientRecovery，避免无限刷新。
 */
export function ChunkLoadRecovery() {
  // 同一个 chunk 失败往往同时触发 error 与 unhandledrejection，用 ref 保证只处理一次
  const recoveringRef = useRef(false);

  useEffect(() => {
    const triggerRecovery = () => {
      if (recoveringRef.current) return;
      recoveringRef.current = true;
      // 未真正刷新（冷却期 / 次数用尽 / 离线）时解除标记，后续时间窗口内仍有恢复机会
      if (!attemptTransientRecovery()) recoveringRef.current = false;
    };

    const onError = (event: Event) => {
      const target = event.target as Element | null;

      // 资源加载失败（如 <script src> 404）不会冒泡到 window 的普通监听，
      // 只有 capture 阶段能拿到；这类事件没有 error/message，只能看 target。
      if (target && target.tagName === "SCRIPT") {
        const src = (target as HTMLScriptElement).src ?? "";
        if (src.includes("/_next/static/chunks/")) triggerRecovery();
        return;
      }

      const errorEvent = event as ErrorEvent;
      // event.error 是真实的错误对象；跨域脚本等场景下只有 message 可用，两者都看
      if (
        isRecoverableTransientError(errorEvent.error) ||
        isRecoverableTransientError(errorEvent.message)
      ) {
        triggerRecovery();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isRecoverableTransientError(event.reason)) triggerRecovery();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
