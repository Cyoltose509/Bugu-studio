"use client";

/**
 * 客户端图片上传统一入口
 *
 * 背景（重要）：站点部署在 Vercel，Serverless Function 的请求体有硬上限。
 * 超过这个体积时，请求根本到不了 Next.js —— Vercel 边缘直接返回纯文本：
 *
 *     Request Entity Too Large
 *     FUNCTION_PAYLOAD_TOO_LARGE
 *     hnd1::xxxx
 *
 * 前端 `await res.json()` 解析这段非 JSON 文本就会抛
 * `Unexpected token 'R', "Request En"... is not valid JSON`。
 * 那个 'R' 就是 "Request Entity Too Large" 的首字母。
 *
 * 具体数值见 ./uploadLimits.ts（2026-10-12 对生产站实测：请求体上限
 * 4,491,679 ~ 4,492,093 字节），本文件不再自己定义阈值。
 *
 * 所以这里的策略是：
 *   1. 能不动就不动 —— 原图体积在安全阀以内就直接上传，一个字节都不重编码。
 *   2. 超限的一律过压缩算法，且先只降质量、保住原始分辨率，实在不行再缩尺寸。
 *   3. 压缩完仍超限就不再发送（否则必然 413），直接给中文提示。
 *   4. 解析响应先取文本再 try JSON，413 / 非 JSON 都给出中文提示。
 */

// 限额统一在 uploadLimits.ts 定义，客户端与服务端共用同一份，避免两边口径不一致
import {
  UPLOAD_LIMIT_BYTES,
  UPLOAD_LIMIT_MB,
  AVATAR_LIMIT_BYTES,
  formatMB,
} from "./uploadLimits";
import { DEFAULT_LANG, type Lang } from "../i18n/config";
import { t } from "../i18n/dict";

export { UPLOAD_LIMIT_BYTES, UPLOAD_LIMIT_MB, AVATAR_LIMIT_BYTES, formatMB };

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_MIME as readonly string[]).includes(file.type);
}

/** 上传前的类型/体积预检，抛本地化错误 */
export function assertImageFile(file: File, lang: Lang = DEFAULT_LANG): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(t(lang, "upload.typeErr"));
  }
  if (file.type === "image/gif") {
    throw new Error(t(lang, "upload.gifErr"));
  }
  if (!isAcceptedImage(file)) {
    throw new Error(t(lang, "upload.formatErr", { type: file.type || "未知" }));
  }
}

// ────────────────────────────── 解码 / 编码 ──────────────────────────────

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  objectUrl: string | null;
  dispose: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片读取失败"));
    img.src = src;
  });
}

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap 支持按 EXIF 摆正方向，且不用走 DOM 解码
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return {
        source: bmp,
        width: bmp.width,
        height: bmp.height,
        objectUrl: null,
        dispose: () => bmp.close?.(),
      };
    } catch {
      // Safari 老版本等不支持 options，走下面的 <img> 分支
    }
  }
  const objectUrl = URL.createObjectURL(file);
  const img = await loadImage(objectUrl);
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    objectUrl,
    dispose: () => {},
  };
}

function drawToCanvas(
  decoded: Decoded,
  maxSide: number,
): HTMLCanvasElement {
  const longest = Math.max(decoded.width, decoded.height);
  const scale = maxSide > 0 && longest > maxSide ? maxSide / longest : 1;
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas，无法压缩图片");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * 优先 WebP（同样画质体积小一半、且保留透明通道），
 * 浏览器不支持时回退 JPEG（Chrome 对不支持的 mime 会静默产出 png，所以要回读 blob.type 判断）
 */
async function encode(
  decoded: Decoded,
  maxSide: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = drawToCanvas(decoded, maxSide);
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  return jpeg && jpeg.type === "image/jpeg" ? jpeg : webp;
}

function renameFor(name: string, type: string): string {
  const base = (name || "image").replace(/\.[^.]+$/, "") || "image";
  const ext =
    type === "image/webp" ? ".webp" : type === "image/png" ? ".png" : ".jpg";
  return `${base}${ext}`;
}

const QUALITY_LADDER = [0.92, 0.85, 0.78, 0.7, 0.62];

export interface FitResult {
  file: File;
  /** 是否经过重编码。false 表示原图直传 */
  compressed: boolean;
  originalSize: number;
}

/**
 * 把图片压到 limit 以内。原图本来就小于 limit 时原样返回，不重编码。
 */
export async function fitWithinLimit(
  file: File,
  limit: number = UPLOAD_LIMIT_BYTES,
  lang: Lang = DEFAULT_LANG,
): Promise<FitResult> {
  if (file.size <= limit) {
    return { file, compressed: false, originalSize: file.size };
  }

  const decoded = await decode(file);
  try {
    const longest = Math.max(decoded.width, decoded.height);
    // 按面积估算目标边长：体积大致与像素数成正比
    let side = Math.max(
      640,
      Math.round(longest * Math.sqrt(limit / file.size) * 0.95),
    );

    // 用对象持有而不是 let 变量：闭包里赋值时 TS 的控制流分析会把 let 窄化成 null，
    // 后面读到的类型会变成 never
    const holder: { best: Blob | null } = { best: null };
    const accept = (blob: Blob | null): File | null => {
      if (!blob) return null;
      holder.best = blob;
      if (blob.size <= limit) {
        return new File([blob], renameFor(file.name, blob.type), {
          type: blob.type,
          lastModified: Date.now(),
        });
      }
      return null;
    };

    // 第一轮：保持原始分辨率，只降质量 —— 这是最接近原图的结果。
    // 超大图（>4 倍限额）跳过这一轮，否则要连续编码 5 张巨幅画布，太慢。
    if (file.size <= limit * 4) {
      for (const q of QUALITY_LADDER) {
        const done = accept(await encode(decoded, 0, q));
        if (done) return { file: done, compressed: true, originalSize: file.size };
      }
    }

    // 之后：按估算边长逐步缩小
    for (let round = 0; round < 4; round++) {
      for (const q of QUALITY_LADDER) {
        const done = accept(await encode(decoded, side, q));
        if (done) return { file: done, compressed: true, originalSize: file.size };
      }
      side = Math.max(640, Math.round(side * 0.72));
    }

    // 兜底：主循环没压到限额以内时，再按更小的边长 + 更低的质量走一轮。
    // 4.2MB 的限额下 640px 不可能压不进去，能走到这里说明是极端输入。
    for (const s of [1280, 960, 720, 640]) {
      for (const q of [0.6, 0.5, 0.4]) {
        const done = accept(await encode(decoded, s, q));
        if (done) return { file: done, compressed: true, originalSize: file.size };
      }
    }

    // 仍然超限就不要发了 —— 发出去必然是 413，不如给一句明确的中文提示
    const best = holder.best;
    if (best && best.size <= limit) {
      return {
        file: new File([best], renameFor(file.name, best.type), {
          type: best.type,
          lastModified: Date.now(),
        }),
        compressed: true,
        originalSize: file.size,
      };
    }
    throw new Error(
      t(lang, "upload.tooLarge", {
        size: formatMB(best?.size ?? file.size),
        limit: formatMB(limit),
      }),
    );
  } finally {
    decoded.dispose();
    if (decoded.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
  }
}

// ────────────────────────────── 上传 ──────────────────────────────

/** 先取文本再 try JSON.parse —— 413 时 Vercel 返回的是纯文本，不是 JSON */
async function parseBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface UploadOptions {
  endpoint: string;
  /** 附带给后端的 type 字段（部分接口会读） */
  type?: string;
  /** 该接口的体积上限，默认 4.2MB（头像接口传 1.9MB） */
  limit?: number;
  signal?: AbortSignal;
  /** 当前语言，用于本地化上传过程中的错误提示（默认中文） */
  lang?: Lang;
}

export interface UploadResult {
  url: string;
  compressed: boolean;
  originalSize: number;
  uploadedSize: number;
}

export async function uploadImage(
  file: File,
  { endpoint, type, limit = UPLOAD_LIMIT_BYTES, signal, lang = DEFAULT_LANG }: UploadOptions,
): Promise<UploadResult> {
  assertImageFile(file, lang);

  const fitted = await fitWithinLimit(file, limit, lang);

  // 压缩完仍然超限就不发了：Vercel 边缘会直接返回纯文本 413，
  // 用户只会看到莫名其妙的报错。这里拦下来给明确提示。
  if (fitted.file.size > limit) {
    throw new Error(
      t(lang, "upload.tooLarge", {
        size: formatMB(fitted.file.size),
        limit: formatMB(limit),
      }),
    );
  }

  const fd = new FormData();
  fd.append("file", fitted.file, fitted.file.name);
  if (type) fd.append("type", type);

  const res = await fetch(endpoint, { method: "POST", body: fd, signal });
  const payload = await parseBody(res);

  if (res.status === 413) {
    throw new Error(
      t(lang, "upload.serverTooLarge", {
        size: formatMB(fitted.file.size),
        limit: UPLOAD_LIMIT_MB,
      }),
    );
  }
  if (!res.ok) {
    throw new Error(payload?.error || t(lang, "upload.httpErr", { status: res.status }));
  }

  const url: string | undefined = payload?.url || payload?.data?.url;
  if (!url) throw new Error(t(lang, "upload.noUrl"));

  return {
    url,
    compressed: fitted.compressed,
    originalSize: fitted.originalSize,
    uploadedSize: fitted.file.size,
  };
}

/** 压缩过的话给一句提示文案，没压缩就返回空串 */
export function compressionNote(result: UploadResult, lang: Lang = DEFAULT_LANG): string {
  if (!result.compressed) return "";
  return t(lang, "upload.compressed", {
    from: formatMB(result.originalSize),
    to: formatMB(result.uploadedSize),
  });
}
