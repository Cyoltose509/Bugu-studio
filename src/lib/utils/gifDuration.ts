/** GIF 最长时长（秒）。超过则拒绝，避免把长动画当截图传上来。 */
export const GIF_MAX_SECONDS = 10;

export function isGifUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  return /\.gif(?:$|\?|#)/i.test(src) || src.startsWith("data:image/gif");
}

/**
 * 解析 GIF 播放时长（秒）。读 Graphic Control Extension 的帧延迟并求和。
 * 延迟为 0 时按浏览器惯例记 10/100 秒。解析失败返回 null。
 */
export function readGifDurationSeconds(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 13) return null;

  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  if (header !== "GIF87a" && header !== "GIF89a") return null;

  let i = 13;
  const packed = bytes[10];
  if (packed & 0x80) {
    i += 3 * (1 << ((packed & 0x07) + 1));
  }

  let delayHundredths = 0;
  let frames = 0;

  while (i < bytes.length) {
    const marker = bytes[i];
    if (marker === 0x3b) break;

    if (marker === 0x21) {
      const label = bytes[i + 1];
      if (label === 0xf9 && bytes[i + 2] === 0x04 && i + 7 < bytes.length) {
        const delay = bytes[i + 4] | (bytes[i + 5] << 8);
        delayHundredths += delay === 0 ? 10 : delay;
        i += 8;
        continue;
      }
      i += 2;
      while (i < bytes.length) {
        const size = bytes[i];
        i += 1;
        if (size === 0) break;
        i += size;
      }
      continue;
    }

    if (marker === 0x2c) {
      if (i + 10 >= bytes.length) return null;
      frames += 1;
      const localPacked = bytes[i + 9];
      i += 10;
      if (localPacked & 0x80) {
        i += 3 * (1 << ((localPacked & 0x07) + 1));
      }
      i += 1;
      while (i < bytes.length) {
        const size = bytes[i];
        i += 1;
        if (size === 0) break;
        i += size;
      }
      continue;
    }

    i += 1;
  }

  if (frames === 0) return null;
  return delayHundredths / 100;
}

/** 服务端校验：非 GIF 返回 null；不合法返回错误文案 */
export function gifUploadError(buffer: ArrayBuffer, mimeType: string): string | null {
  if (mimeType !== "image/gif") return null;
  const duration = readGifDurationSeconds(buffer);
  if (duration == null) return "无法解析该 GIF";
  if (duration > GIF_MAX_SECONDS) return `GIF 时长不能超过 ${GIF_MAX_SECONDS} 秒`;
  return null;
}
