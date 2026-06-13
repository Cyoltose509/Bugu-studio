/**
 * 图片导出工具
 *
 * 核心策略：html-to-image（SVG foreignObject → 像素级字体一致）
 * 图片跨域：用同源代理 /api/image-proxy?url= 替换跨域 URL
 */

import { toPng } from "html-to-image";

const PROXY_PATH = "/api/image-proxy?url=";

// ═══════════════════════════════════════════════════════
//  公开 API
// ═══════════════════════════════════════════════════════

/**
 * 渲染单个元素到 Canvas（不含图片预处理——调用方需自己 prepareImagesForExport）
 */
export async function renderElementToCanvas(
  el: HTMLElement,
  options?: { scale?: number; bg?: string }
): Promise<HTMLCanvasElement> {
  const scale = options?.scale ?? 3;
  const bg = options?.bg ?? "#faf8f5";

  await waitForFonts();
  await waitTwoFrames();

  try {
    const dataUrl = await toPng(el, {
      pixelRatio: scale,
      backgroundColor: bg,
      skipAutoScale: true,
      cacheBust: true,
    });
    return await dataUrlToCanvas(dataUrl);
  } catch (htmlToImageErr) {
    console.warn("html-to-image 失败，回退 html2canvas:", htmlToImageErr);
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(el, {
      scale,
      backgroundColor: bg,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
  }
}

// ═══════════════════════════════════════════════════════
//  图片预处理
// ═══════════════════════════════════════════════════════

/**
 * 预处理容器内所有 <img>：
 *  1. 强制 loading=eager
 *  2. 等待加载
 *  3. 跨域图片 → 同源代理 URL
 *  4. 等待代理 URL 图片就绪
 *  5. 返回 restore 函数
 */
export async function prepareImagesForExport(
  container: HTMLElement
): Promise<() => void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  const restores: Array<() => void> = [];

  // 1. 强制 eager
  for (const img of imgs) {
    const el = img as HTMLImageElement;
    if (el.loading === "lazy") {
      el.loading = "eager";
      restores.push(() => { el.loading = "lazy"; });
    }
  }

  // 2. 等待图片加载（10 秒超时）
  await Promise.race([
    waitForImages(container),
    new Promise((r) => setTimeout(r, 10000)),
  ]);

  // 3. 跨域 → 同源代理
  const origin = window.location.origin;
  for (const img of imgs) {
    const el = img as HTMLImageElement;
    const src = el.currentSrc || el.src;
    if (!src || src.startsWith("data:") || src.startsWith(origin)) continue;

    // 检查是否跨域
    try {
      const url = new URL(src, origin);
      if (url.origin === origin) continue;
    } catch {
      continue; // 无效 URL，跳过
    }

    // 替换为同源代理
    const proxyUrl = `${PROXY_PATH}${encodeURIComponent(src)}`;
    const origSrc = src;
    restores.push(() => {
      el.src = origSrc;
      if (el.srcset) el.srcset = el.srcset;
    });
    el.src = proxyUrl;
    el.removeAttribute("srcset");
    el.removeAttribute("sizes");
  }

  // 4. 等待代理 URL 图片就绪（15 秒超时）
  await Promise.race([
    waitForImages(container),
    new Promise((r) => setTimeout(r, 15000)),
  ]);

  return () => {
    for (const restore of restores) restore();
  };
}

// ═══════════════════════════════════════════════════════
//  内部工具
// ═══════════════════════════════════════════════════════

function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = container.querySelectorAll("img");
  const promises = Array.from(imgs).map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    });
  });
  if (promises.length === 0) return Promise.resolve();
  return Promise.all(promises).then(() => undefined);
}

async function waitForFonts(): Promise<void> {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }
}

function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("dataUrlToCanvas 失败"));
    img.src = dataUrl;
  });
}

function waitTwoFrames(): Promise<void> {
  return new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );
}
