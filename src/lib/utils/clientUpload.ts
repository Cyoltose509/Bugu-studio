"use client";

/**
 * 客户端图片上传统一入口
 *
 * 背景（重要）：站点部署在 Vercel，Serverless Function 的请求体上限是 4.5MB。
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
 * 所以这里的策略是：
 *   1. 能不动就不动 —— 原图体积在安全阀以内就直接上传，一个字节都不重编码。
 *   2. 超限时才压缩，且先只降质量、保住原始分辨率，实在不行再缩尺寸。
 *   3. 解析响应先取文本再 try JSON，413 / 非 JSON 都给出中文提示。
 */

/** 实际发送上限。Vercel 硬限 4.5MB，留出 0.3MB 给 multipart 边界和字段头 */
export const UPLOAD_LIMIT_BYTES = 4.2 * 1024 * 1024;
/** 展示用的服务器硬限（Vercel 侧） */
export const UPLOAD_LIMIT_MB = 4.5;

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

/** 头像接口自己的限额是 2MB */
export const AVATAR_LIMIT_BYTES = 1.9 * 1024 * 1024;

export function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_MIME as readonly string[]).includes(file.type);
}

/** 上传前的类型/体积预检，抛中文错误 */
export function assertImageFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("请拖入图片文件");
  }
  if (file.type === "image/gif") {
    throw new Error("暂不支持 GIF，请先转换为 JPG / PNG / WebP");
  }
  if (!isAcceptedImage(file)) {
    throw new Error(`不支持的图片格式：${file.type || "未知"}，仅支持 JPG / PNG / WebP`);
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

    let best: Blob | null = null;
    const accept = (blob: Blob | null): File | null => {
      if (!blob) return null;
      best = blob;
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

    if (best) {
      const blob = best as Blob;
      return {
        file: new File([blob], renameFor(file.name, blob.type), {
          type: blob.type,
          lastModified: Date.now(),
        }),
        compressed: true,
        originalSize: file.size,
      };
    }
    throw new Error("图片压缩失败，请换一张试试");
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
}

export interface UploadResult {
  url: string;
  compressed: boolean;
  originalSize: number;
  uploadedSize: number;
}

export async function uploadImage(
  file: File,
  { endpoint, type, limit = UPLOAD_LIMIT_BYTES, signal }: UploadOptions,
): Promise<UploadResult> {
  assertImageFile(file);

  const fitted = await fitWithinLimit(file, limit);

  const fd = new FormData();
  fd.append("file", fitted.file, fitted.file.name);
  if (type) fd.append("type", type);

  const res = await fetch(endpoint, { method: "POST", body: fd, signal });
  const payload = await parseBody(res);

  if (res.status === 413) {
    throw new Error(
      `图片过大（${formatMB(fitted.file.size)}MB），服务器最多接收 ${UPLOAD_LIMIT_MB}MB，请压缩后再试`,
    );
  }
  if (!res.ok) {
    throw new Error(payload?.error || `上传失败（HTTP ${res.status}）`);
  }

  const url: string | undefined = payload?.url || payload?.data?.url;
  if (!url) throw new Error("上传失败：服务器未返回图片地址");

  return {
    url,
    compressed: fitted.compressed,
    originalSize: fitted.originalSize,
    uploadedSize: fitted.file.size,
  };
}

/** 压缩过的话给一句提示文案，没压缩就返回空串 */
export function compressionNote(result: UploadResult): string {
  if (!result.compressed) return "";
  return `已压缩：${formatMB(result.originalSize)}MB → ${formatMB(result.uploadedSize)}MB`;
}
