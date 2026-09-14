/**
 * 全屏加载层互斥：布谷娘优先于 Logo，同时只显示一种
 */
export type LoadingScreenKind = "mascot" | "logo";

const listeners = new Set<() => void>();

let mascotRetainers = 0;
let logoRetainers = 0;

export function getActiveLoadingScreen(): LoadingScreenKind | null {
  if (mascotRetainers > 0) return "mascot";
  if (logoRetainers > 0) return "logo";
  return null;
}

export function isMascotLoadingActive() {
  return mascotRetainers > 0;
}

export function notifyLoadingScreenChange() {
  listeners.forEach((fn) => fn());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bugoo-loading-screen"));
  }
}

export function retainLoadingScreen(kind: LoadingScreenKind) {
  if (kind === "mascot") mascotRetainers += 1;
  else logoRetainers += 1;
  notifyLoadingScreenChange();
}

export function releaseLoadingScreen(kind: LoadingScreenKind) {
  if (kind === "mascot") mascotRetainers = Math.max(0, mascotRetainers - 1);
  else logoRetainers = Math.max(0, logoRetainers - 1);
  notifyLoadingScreenChange();
}

export function subscribeLoadingScreen(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 全屏居中遮罩 class（CSS 里定义）；布谷娘 z 高于 Logo */
export const LOADING_SCREEN_CLASS = "loading-screen-overlay";
export const LOADING_SCREEN_Z_LOGO = 9998;
export const LOADING_SCREEN_Z_MASCOT = 10000;
export const LOADING_SCREEN_Z = LOADING_SCREEN_Z_MASCOT;
