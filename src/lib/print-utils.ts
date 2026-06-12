/**
 * 打印/导出工具
 *
 * 核心原则：绝不移变原始 DOM。所有路径都先 cloneNode → wrapper → 在 wrapper 上操作 → 渲染后移除 wrapper。
 * 这确保第二次保存不会因为前次 restore 的残留状态而出错。
 */

import { renderElementToCanvas, prepareImagesForExport } from "./image-export";

// ═══════════════════════════════════════════════════════
//  Clone helper（所有 save 路径共享）
// ═══════════════════════════════════════════════════════

/**
 * 把原件克隆到临时容器（absolute 定位在视口原点），附加到 body，返回 wrapper
 *
 * 使用 DOMParser（而非 cloneNode）确保完全独立的 DOM 节点——
 * 序列化 → 反序列化，切断所有隐式引用，杜绝第二次保存时的图片错乱。
 */
function mountClone(el: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute;left:0;top:0;width:880px;z-index:99999;";
  const parser = new DOMParser();
  const doc = parser.parseFromString(el.outerHTML, "text/html");
  const clone = doc.body.firstElementChild as HTMLElement;
  if (!clone) throw new Error("mountClone: 解析 HTML 失败");
  clone.querySelectorAll("[data-save-buttons]").forEach((b) => b.remove());
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return wrapper;
}

/** 移除临时容器 */
function unmountClone(wrapper: HTMLElement): void {
  wrapper.remove();
}

// ═══════════════════════════════════════════════════════
//  图片导出
// ═══════════════════════════════════════════════════════

/** 单个报纸保存为图片（不碰原 DOM） */
export async function saveElementAsImage(
  el: HTMLElement,
  filename: string
): Promise<void> {
  const wrapper = mountClone(el);
  try {
    await prepareImagesForExport(wrapper); // 在克隆上准备图片（restore 无需关心，wrapper 会被移除）
    const canvas = await renderElementToCanvas(wrapper, { scale: 3, bg: "#faf8f5" });
    if (canvas.width > 0 && canvas.height > 0) {
      await downloadCanvas(canvas, filename, "image/png");
    } else {
      console.error("保存图片失败: canvas 尺寸为 0");
    }
  } finally {
    unmountClone(wrapper);
  }
}

/**
 * 所有报纸保存为一张长图
 *
 * 关键：使用 position:absolute 渲染在视口原点 (0,0)，避免 body 的
 * flex flex-col 布局干扰 wrapper 的 margin:0 auto 居中行为。
 * absolute + visible 位置保证浏览器正常渲染（不像 left:-9999px 被跳过）。
 */
export async function saveAllAsLongImage(
  els: HTMLElement[],
  filename: string,
  gap = 24
): Promise<void> {
  if (els.length === 0) return;

  // 1. 构建临时容器 — 绝对定位在视口左上角，不参与 body flex 布局
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute;left:0;top:0;width:880px;background:#faf8f5;padding:32px 0;box-sizing:content-box;z-index:99999;";

  const parser = new DOMParser();
  for (let i = 0; i < els.length; i++) {
    const doc = parser.parseFromString(els[i].outerHTML, "text/html");
    const clone = doc.body.firstElementChild as HTMLElement;
    if (!clone) continue;
    clone.querySelectorAll("[data-save-buttons]").forEach((b) => b.remove());
    wrapper.appendChild(clone);
    if (i < els.length - 1) {
      const spacer = document.createElement("div");
      spacer.style.height = `${gap}px`;
      wrapper.appendChild(spacer);
    }
  }

  document.body.appendChild(wrapper);

  // 2. 一次图片预处理
  const restore = await prepareImagesForExport(wrapper);

  try {
    // 3. 一次渲染
    const canvas = await renderElementToCanvas(wrapper, { scale: 3, bg: "#faf8f5" });
    if (canvas.width > 0 && canvas.height > 0) {
      await downloadCanvas(canvas, filename, "image/png");
    } else {
      console.error("保存全部长图失败: canvas 尺寸为 0");
    }
  } catch (e) {
    console.error("保存全部长图失败", e);
  } finally {
    restore();
    wrapper.remove();
  }
}

// ═══════════════════════════════════════════════════════
//  PDF 导出（新窗口 → 动态 @page 高度 → 连续单页）
// ═══════════════════════════════════════════════════════

/** 单个报纸 → PDF（不碰原 DOM） */
export async function saveElementAsPDF(
  el: HTMLElement,
  filename: string
): Promise<void> {
  const wrapper = mountClone(el);
  try {
    await prepareImagesForExport(wrapper);
    const prepared = wrapper.firstElementChild as HTMLElement;
    const html = prepared.outerHTML;
    unmountClone(wrapper);
    printInNewWindow([html], filename, false);
  } catch (e) {
    unmountClone(wrapper);
    throw e;
  }
}

/** 全部报纸 → 一份 PDF（不碰原 DOM） */
export async function saveAllAsPDF(
  els: HTMLElement[],
  filename: string,
  gap = 24
): Promise<void> {
  if (els.length === 0) return;

  // 逐个克隆 → 准备图片 → 提取 HTML → 清理（串行，保持逻辑简单）
  const htmls: string[] = [];
  for (const el of els) {
    const wrapper = mountClone(el);
    try {
      await prepareImagesForExport(wrapper);
      htmls.push((wrapper.firstElementChild! as HTMLElement).outerHTML);
    } finally {
      unmountClone(wrapper);
    }
  }

  printInNewWindow(htmls, filename, true, gap);
}

// ═══════════════════════════════════════════════════════
//  新窗口打印（动态页高 → 连续单页）
// ═══════════════════════════════════════════════════════

function printInNewWindow(
  htmls: string[],
  filename: string,
  showGap: boolean,
  gap = 24
): void {
  const stylesheets = collectStylesheets();

  // 构建 HTML
  const bodies = htmls
    .map((html) => {
      const margin = showGap ? `padding-bottom:${gap}px;` : "";
      return `<div class="pw-article" style="max-width:880px;margin:0 auto;${margin}">${html}</div>`;
    })
    .join("");

  const title = filename.replace(/\.pdf$/i, "");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
${stylesheets}
<style>
  *,*::before,*::after{box-sizing:border-box}
  /* 覆盖 Tailwind base body 样式（它会给 body 加渐变背景） */
  body{margin:0!important;padding:32px 16px!important;background:#faf8f5!important;color:#333!important;font-family:"Noto Serif SC","Source Han Serif SC","SimSun",Georgia,serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;min-height:auto!important}
  .pw-article{page-break-after:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  /* 确保报头渐变线在打印时可见（强制渲染背景） */
  .pw-article *{ -webkit-print-color-adjust:exact;print-color-adjust:exact }
  /* 反制收集来的 HistoryClient @media print 样式（它用 display:none 隐藏所有 header/nav/footer） */
  .pw-article header,.pw-article nav,.pw-article footer{display:block!important}
  @media print{
    body{padding:0 16px!important;background:#fff!important}
    @page{margin:8mm}
    /* 报纸卡片在打印时保留背景色和阴影 */
    .newspaper-paper{background:#faf8f5!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    /* 更高优先级覆盖：报头必须显示 */
    .pw-article header,.pw-article nav,.pw-article footer{display:block!important}
  }
</style>
</head>
<body>
<div id="pw-wrapper">${bodies}</div>
<script>
  // 测量内容高度，动态设置 @page size 为连续单页
  (function(){
    var wrapper=document.getElementById("pw-wrapper");
    var h=wrapper.scrollHeight;
    // px → mm (96dpi: 1px ≈ 0.264583mm)
    var hmm=Math.ceil(h*0.264583)+16;
    var style=document.createElement("style");
    style.textContent="@media print{@page{size:210mm "+hmm+"mm;margin:8mm}}";
    document.head.appendChild(style);
  })();
</script>
</body>
</html>`;

  // 打开新窗口（在点击事件同帧内，不被拦截）
  const w = window.open("", "_blank");
  if (!w) {
    alert("请允许弹出窗口以保存 PDF（浏览器可能拦截了新窗口）");
    return;
  }

  w.document.write(html);
  w.document.close();

  waitForWindowReady(w).then(() => {
    // 等待一帧让内联 script 执行完
    w.requestAnimationFrame(() => {
      w.print();
    });
    const onAfter = () => {
      w.removeEventListener("afterprint", onAfter);
      w.close();
    };
    w.addEventListener("afterprint", onAfter, { once: true });
    setTimeout(() => { try { w.close(); } catch {} }, 15000);
  });
}

function collectStylesheets(): string {
  const parts: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = (link as HTMLLinkElement).href;
    if (href) parts.push(`<link rel="stylesheet" href="${href}">`);
  });
  document.querySelectorAll("style").forEach((s) => {
    const text = s.textContent || "";
    if (text.trim()) parts.push(`<style>${text}</style>`);
  });
  return parts.join("\n");
}

async function waitForWindowReady(w: Window): Promise<void> {
  await new Promise<void>((resolve) => {
    if (w.document.readyState === "complete") resolve();
    else w.addEventListener("load", () => resolve(), { once: true });
  });
  await new Promise<void>((r) => w.requestAnimationFrame(() => r()));

  // 等字体
  if (w.document.fonts?.ready) {
    try { await Promise.race([w.document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]); } catch {}
  }

  // 等图片
  const imgs = w.document.querySelectorAll("img");
  await Promise.race([
    Promise.all(Array.from(imgs).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })),
    new Promise((r) => setTimeout(r, 10000)),
  ]);

  await new Promise<void>((r) => w.requestAnimationFrame(() => r()));
}

// ═══════════════════════════════════════════════════════

function downloadCanvas(canvas: HTMLCanvasElement, filename: string, type: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = filename;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, type, 0.95);
  });
}
