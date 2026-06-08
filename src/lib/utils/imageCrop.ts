/**
 * 图片裁剪 + 压缩工具
 * 依赖: react-easy-crop（已安装）
 *
 * 使用方式：
 *   const { crop, compressedFile } = useImageCropCompress();
 *   // 在裁剪 Modal 中渲染 <CropArea image={imageSrc} onCropDone={...} />
 */

import { useState, useCallback } from "react";
import { Point, Area } from "react-easy-crop";

export interface CropResult {
  blob: Blob;
  url: string;   // object URL，用于预览
  file: File;
}

/**
 * 用 Canvas 裁剪图片（根据 react-easy-crop 返回的 croppedAreaPixels）
 */
export async function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: Area,
  maxWidth = 800,
  quality = 0.8
): Promise<CropResult> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // 限制输出尺寸（节省空间）
  let { width, height } = croppedAreaPixels;
  if (width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;

  ctx?.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas 生成失败"));
        const url = URL.createObjectURL(blob);
        const file = new File([blob], "cropped.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        resolve({ blob, url, file });
      },
      "image/jpeg",
      quality
    );
  });
}

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

/**
 * 压缩图片（不裁剪，仅缩小尺寸 + 降低质量）
 * 用于不需要裁剪的场景，或裁剪后的二次压缩
 */
export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.8
): Promise<File> {
  const img = await createImage(URL.createObjectURL(file));
  const canvas = document.createElement("canvas");

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("压缩失败"));
        resolve(
          new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
        );
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * 读取 File 为 data URL（用于 react-easy-crop 的 image prop）
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}
