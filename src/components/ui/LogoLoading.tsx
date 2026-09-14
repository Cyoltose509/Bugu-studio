"use client";

import { useEffect } from "react";
import {
  LOADING_SCREEN_CLASS,
  isMascotLoadingActive,
  releaseLoadingScreen,
  retainLoadingScreen,
  subscribeLoadingScreen,
} from "@/components/ui/loading-screen";

type LogoLayer = {
  root: HTMLDivElement;
  textEl: HTMLParagraphElement;
  retainers: number;
};

let logoLayer: LogoLayer | null = null;

function ensureLogoLayer(): LogoLayer {
  if (logoLayer) return logoLayer;

  const root = document.createElement("div");
  root.className = LOADING_SCREEN_CLASS;
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-loading-screen", "logo");
  root.innerHTML = `
    <div class="logo-spin-stage" aria-hidden="true">
      <div class="logo-spin-cycle">
        <img
          src="/images/logo.png"
          alt=""
          width="64"
          height="64"
          class="rounded-xl shadow-md"
          style="width:100%;height:100%;object-fit:contain"
        />
      </div>
    </div>
    <p class="loading-screen-text text-brand-text-muted" data-logo-text>加载中...</p>
  `;
  document.body.appendChild(root);
  const textEl = root.querySelector("[data-logo-text]") as HTMLParagraphElement;
  logoLayer = { root, textEl, retainers: 0 };
  return logoLayer;
}

function destroyLogoLayer() {
  if (!logoLayer) return;
  logoLayer.root.remove();
  logoLayer = null;
}

function syncLogoVisibility() {
  if (!logoLayer) return;
  // 布谷娘优先：同屏只保留一种加载动画
  logoLayer.root.style.display =
    isMascotLoadingActive() || logoLayer.retainers <= 0 ? "none" : "";
}

function retainLogo(text: string) {
  if (typeof document === "undefined") return;
  retainLoadingScreen("logo");
  const L = ensureLogoLayer();
  L.retainers += 1;
  L.textEl.textContent = text;
  syncLogoVisibility();
}

function releaseLogo() {
  releaseLoadingScreen("logo");
  if (!logoLayer) return;
  logoLayer.retainers = Math.max(0, logoLayer.retainers - 1);
  if (logoLayer.retainers > 0) {
    syncLogoVisibility();
    return;
  }
  // Strict Mode 假卸载缓冲
  window.setTimeout(() => {
    if (!logoLayer || logoLayer.retainers > 0) return;
    destroyLogoLayer();
  }, 40);
}

/**
 * Logo 加载 — 全屏置顶居中单例
 * 若布谷娘已在跑则不显示，避免一页两个加载动画
 */
export default function LogoLoading({
  text = "加载中...",
  compact: _compact = false,
}: {
  text?: string;
  /** @deprecated 已统一全屏居中，保留参数以免改调用处 */
  compact?: boolean;
}) {
  useEffect(() => {
    retainLogo(text);
    const unsub = subscribeLoadingScreen(syncLogoVisibility);
    return () => {
      unsub();
      releaseLogo();
    };
  }, [text]);

  return <div data-logo-loading hidden aria-hidden />;
}
