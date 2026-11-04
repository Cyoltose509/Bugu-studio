/**
 * 服务端 favicon 抓取：给工具站条目保存时使用。
 *
 * 为什么在服务端抓而不是热链：目标站 favicon 在访客网络（尤其国内）经常不可达，
 * 热链会成片失败回退字标。保存时由服务器抓一次，转 PNG 上传到自家 R2，
 * 之后所有访客都走自家 CDN，稳定可达。
 *
 * 抓取链（一律取自目标站本身，不走 Google s2 的二手缓存）：
 *   HTML 里声明的 <link rel="icon">（按 sizes 从大到小）
 *   → /favicon.ico
 *   → /apple-touch-icon.png
 * 全部失败返回空串（前端回退品牌色字标）——宁可出字标，也不用别家的通用图标。
 *
 * 透明底一律保留：只用 resize 的透明留白 + PNG 输出，全程不 flatten。
 */
import sharp from "sharp";
import { uploadToR2 } from "@/lib/utils/upload";

const FETCH_TIMEOUT_MS = 8000;
const MIN_BYTES = 100;
const MAX_BYTES = 2_000_000;
/** HTML 只读前若干字符，够解析 <head> 就行，避免把整页大文档拉下来 */
const MAX_HTML_CHARS = 200_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** 判 ICO：reserved=0 + type=1 */
function isIco(buf: Buffer): boolean {
    return buf.length >= 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;
}

type DecodedIcon =
    | { kind: "buffer"; buffer: Buffer }
    | { kind: "raw"; data: Buffer; width: number; height: number };

/**
 * ICO → sharp 可读的输入。
 *
 * libvips 不支持 ICO（实测报 `Input file contains unsupported image format`），
 * 所以 `/favicon.ico` 这条以前 100% 失败，只有 Google s2 能出图——s2 没有的站点
 * 就只剩字标。这里按 ICO 目录挑最大的一帧自己解：内嵌 PNG 直接交给 sharp；
 * BMP 形式（BITMAPINFOHEADER + 自下而上的 BGRA/BGR + 1bpp 的 AND 掩码）手工转
 * RGBA，掩码位为 1 的像素置透，保住透明底。
 */
/** @internal 导出仅为单测覆盖 ICO 解码，业务代码只用 resolveFavicon */
export function decodeIco(buf: Buffer): DecodedIcon | null {
    if (!isIco(buf)) return null;
    const count = buf.readUInt16LE(4);
    let best: { size: number; offset: number; width: number; height: number } | null = null;
    for (let i = 0; i < count; i++) {
        const entry = 6 + i * 16;
        if (entry + 16 > buf.length) break;
        const width = buf[entry] || 256; // 0 表示 256
        const height = buf[entry + 1] || 256;
        const size = buf.readUInt32LE(entry + 8);
        const offset = buf.readUInt32LE(entry + 12);
        if (!size || offset + size > buf.length) continue;
        if (!best || width * height > best.width * best.height) best = { size, offset, width, height };
    }
    if (!best) return null;

    const payload = buf.subarray(best.offset, best.offset + best.size);
    if (payload.subarray(0, 4).equals(PNG_SIGNATURE)) return { kind: "buffer", buffer: payload };

    if (payload.length < 40) return null;
    const headerSize = payload.readUInt32LE(0);
    const bpp = payload.readUInt16LE(14);
    if (headerSize < 40 || headerSize > payload.length) return null;
    if (bpp !== 32 && bpp !== 24 && bpp !== 8 && bpp !== 4) return null; // 1/16 位太罕见，交给字标兜底

    const { width, height } = best;
    // 8/4 位是调色板索引图，调色板紧跟在 BITMAPINFOHEADER 之后，每项 4 字节 BGRA
    const paletteCount = bpp <= 8 ? payload.readUInt32LE(32) || 1 << bpp : 0;
    const paletteOffset = headerSize;
    const xorStart = headerSize + paletteCount * 4;
    const xorRowBytes =
        bpp === 32
            ? width * 4
            : bpp === 24
              ? Math.ceil((width * 3) / 4) * 4
              : bpp === 8
                ? Math.ceil(width / 4) * 4
                : Math.ceil(width / 8) * 4; // 4bpp：一行 width/2 字节，再补齐到 4
    const xorSize = xorRowBytes * height;
    const pixels = payload.subarray(xorStart, xorStart + xorSize);
    if (pixels.length < xorSize) return null;

    // AND 掩码紧跟在 XOR 位图之后：1 位/像素，行按 4 字节对齐，同样自下而上
    const maskRowBytes = Math.ceil(width / 32) * 4;
    const maskOffset = xorStart + xorSize;
    const hasMask = payload.length >= maskOffset + maskRowBytes * height;
    const transparentAt = (x: number, y: number) => {
        if (!hasMask) return false;
        const row = maskOffset + (height - 1 - y) * maskRowBytes;
        return ((payload[row + (x >> 3)] >> (7 - (x & 7))) & 1) === 1;
    };

    const out = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * xorRowBytes;
        for (let x = 0; x < width; x++) {
            const d = (y * width + x) * 4;
            if (bpp === 32 || bpp === 24) {
                const s = src + x * (bpp / 8);
                out[d] = pixels[s + 2];
                out[d + 1] = pixels[s + 1];
                out[d + 2] = pixels[s];
                out[d + 3] = bpp === 32 ? pixels[s + 3] : 255;
            } else {
                const index =
                    bpp === 8
                        ? pixels[src + x]
                        : (pixels[src + (x >> 1)] >> (x & 1 ? 0 : 4)) & 0x0f;
                const p = paletteOffset + index * 4;
                out[d] = payload[p + 2] ?? 0;
                out[d + 1] = payload[p + 1] ?? 0;
                out[d + 2] = payload[p] ?? 0;
                out[d + 3] = 255;
            }
        }
    }

    // 有的 ICO 把 alpha 通道全填 0、只在 AND 掩码里抠图：此时用掩码还原透明，
    // 而不是一刀切成不透明（切成不透明会糊出一整块实心方块）
    let anyAlpha = false;
    if (bpp === 32) {
        for (let i = 3; i < out.length; i += 4) {
            if (out[i] !== 0) {
                anyAlpha = true;
                break;
            }
        }
    }
    if (!anyAlpha) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                out[(y * width + x) * 4 + 3] = transparentAt(x, y) ? 0 : 255;
            }
        }
    }

    return { kind: "raw", data: out, width, height };
}

/** 取 HTML 里声明的图标地址；mask-icon 是单色蒙版，直接排除
 *  apple-touch-icon 单独一组：它是 iOS 主屏用的**不透明**大图，放最后再用，
 *  否则会把本来有透明底的普通图标顶掉。 */
function iconLinksFromHtml(html: string, base: string): { icons: string[]; touchIcons: string[] } {
    const icons: { url: string; score: number }[] = [];
    const touchIcons: { url: string; score: number }[] = [];
    const tagRe = /<link\b[^>]*>/gi;
    let tag: RegExpExecArray | null;
    while ((tag = tagRe.exec(html))) {
        const attrs: Record<string, string> = {};
        const attrRe = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
        let attr: RegExpExecArray | null;
        while ((attr = attrRe.exec(tag[0]))) {
            attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? "";
        }
        const rel = (attrs.rel || "").toLowerCase();
        const href = (attrs.href || "").trim();
        if (!href || !rel.includes("icon") || rel.includes("mask-icon")) continue;
        if (href.startsWith("data:")) continue;
        let score = 0;
        for (const size of (attrs.sizes || "").match(/\d+/g) || []) score = Math.max(score, Number(size));
        try {
            (rel.includes("apple-touch-icon") ? touchIcons : icons).push({
                url: new URL(href, base).toString(),
                score,
            });
        } catch {
            /* 非法 href 忽略 */
        }
    }
    const order = (list: { url: string; score: number }[]) =>
        [...new Set(list.sort((a, b) => b.score - a.score).map((f) => f.url))].slice(0, 4);
    return { icons: order(icons), touchIcons: order(touchIcons) };
}

async function tryFetch(url: string): Promise<Buffer | null> {
    // 跨境访问经常偶发超时，网络层失败重试一次；HTTP 4xx/5xx 不重试（重试也没用）
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                // 用常见浏览器 UA：不少站点（Trello 一类）对陌生 UA 直接 403，
                // 而它们对浏览器是正常放行图标的
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
                },
                redirect: "follow",
            });
            if (!res.ok) return null;
            return Buffer.from(await res.arrayBuffer());
        } catch {
            continue;
        }
    }
    return null;
}

/** HTML 声明的图标地址；站点被 Cloudflare 拦或整页超时都只当"没声明"，不阻塞后续兜底 */
async function declaredIcons(host: string): Promise<{ icons: string[]; touchIcons: string[] }> {
    const empty = { icons: [], touchIcons: [] };
    const buf = await tryFetch(`https://${host}/`);
    if (!buf || buf.length === 0) return empty;
    return iconLinksFromHtml(buf.toString("utf8").slice(0, MAX_HTML_CHARS), `https://${host}/`);
}

export async function resolveFavicon(siteUrl: string): Promise<string> {
    let host: string;
    try {
        host = new URL(siteUrl).hostname;
    } catch {
        return "";
    }

    const declared = await declaredIcons(host);
    const sources = [
        // 声明的普通图标（多为透明底 PNG/SVG/ICO），按尺寸从大到小
        ...declared.icons,
        `https://${host}/favicon.ico`,
        // 前面都拿不到才退到 iOS 主屏图标：大但通常是不透明方图
        ...declared.touchIcons,
        `https://${host}/apple-touch-icon.png`,
        `https://${host}/apple-touch-icon-precomposed.png`,
    ];

    for (const src of sources) {
        const raw = await tryFetch(src);
        if (!raw || raw.length < MIN_BYTES || raw.length > MAX_BYTES) continue;

        try {
            // ICO 先解出最大的一帧，其余格式（PNG/SVG/JPEG）原样交给 sharp
            const decoded: DecodedIcon | null = isIco(raw) ? decodeIco(raw) : { kind: "buffer", buffer: raw };
            if (!decoded) continue;

            // 统一转 64px PNG：透明底靠 fit:contain + alpha=0 的留白保持，绝不 flatten
            const png = await (decoded.kind === "buffer"
                ? sharp(decoded.buffer, { density: 384 })
                : sharp(decoded.data, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }))
                .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png({ compressionLevel: 9 })
                .toBuffer();

            const safeHost = host.replace(/[^a-z0-9.-]/gi, "_");
            const result = await uploadToR2(png, `favicon-${safeHost}.png`, "image/png", "tools");
            return result.url;
        } catch {
            continue; // 换下一个来源
        }
    }
    return "";
}
